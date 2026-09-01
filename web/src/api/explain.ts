// ---------------------------------------------------------------------------
// Optional LLM explanation layer.
//
// The deterministic engine produces the full plan (scores, ranking, drivers,
// and a local template narrative). When a backend is available, we additionally
// ask Amazon Bedrock to rewrite the narrative into more fluent prose. The
// structured data is NEVER produced by the model — only the narrative text.
//
// The API URL is resolved from, in order:
//   1. VITE_API_URL (baked in at build time; handy for local development)
//   2. /config.json { "apiUrl": "..." } (written at deploy time by CDK)
//
// If neither is present, or the call fails, we transparently fall back to the
// local narrative so the app is always fully functional.
// ---------------------------------------------------------------------------

import type { ResolutionPlan, VariantCase } from "../engine/types";

const ENV = ((import.meta as unknown as { env?: Record<string, string | undefined> })
  .env) ?? {};
const BUILD_TIME_URL = ENV.VITE_API_URL?.replace(/\/$/, "");

let apiUrlPromise: Promise<string | null> | null = null;

async function resolveApiUrl(): Promise<string | null> {
  // 1. Explicit build-time override (used for local dev against a remote/local backend).
  if (BUILD_TIME_URL) return BUILD_TIME_URL;

  // 2. Deployed: the API is served SAME-ORIGIN (CloudFront routes /explain and
  //    /annotate to the backend), so use the current origin. Local dev hosts
  //    (localhost) have no co-located backend, so we do NOT assume same-origin
  //    there — set VITE_API_URL instead.
  if (typeof window !== "undefined" && window.location) {
    const host = window.location.hostname;
    const isLocal =
      host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0";
    if (!isLocal) return window.location.origin.replace(/\/$/, "");
  }

  // 3. Legacy fallback: a runtime config.json, if present and valid.
  try {
    const res = await fetch("/config.json", { cache: "no-store" });
    if (!res.ok) return null;
    const cfg = (await res.json()) as { apiUrl?: string };
    const url = cfg.apiUrl?.trim();
    return url ? url.replace(/\/$/, "") : null;
  } catch {
    return null;
  }
}

export function getApiUrl(): Promise<string | null> {
  if (!apiUrlPromise) apiUrlPromise = resolveApiUrl();
  return apiUrlPromise;
}

/** Best-effort synchronous hint for the header pill (build-time only). */
export function bedrockConfiguredHint(): boolean {
  return Boolean(BUILD_TIME_URL);
}

// Mirror of the server guardrail (defense in depth). The negative lookahead
// avoids false positives on the tool's own "benign-direction"/"pathogenic-leaning"
// hedges; we flag asserted classification tiers, reclassification, and treatment.
const NOT_DIRECTION = "(?!\\s*[-\\u2013]\\s*(direction|leaning))";
const CLIENT_FORBIDDEN: RegExp[] = [
  new RegExp(`\\blikely\\s+(pathogenic|benign)\\b${NOT_DIRECTION}`, "i"),
  new RegExp(
    `\\b(is|are|was|were|be|being|remains?|deemed|considered)\\s+(most\\s+)?(likely\\s+)?(pathogenic|benign)\\b${NOT_DIRECTION}`,
    "i"
  ),
  /\bre-?classif\w*/i,
  /\b(prescrib(e|ing)|start\s+treatment|treat\s+the\s+patient)\b/i,
];

function clientNarrativeIsSafe(text: string): boolean {
  return !CLIENT_FORBIDDEN.some((re) => re.test(text));
}

export interface EnhanceResult {
  plan: ResolutionPlan;
  usedBedrock: boolean;
  error?: string;
}

export async function enhanceNarrative(
  variantCase: VariantCase,
  plan: ResolutionPlan
): Promise<EnhanceResult> {
  const apiUrl = await getApiUrl();
  if (!apiUrl) {
    return { plan, usedBedrock: false };
  }

  try {
    const res = await fetch(`${apiUrl}/explain`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ case: variantCase, plan }),
    });

    if (!res.ok) {
      return { plan, usedBedrock: false, error: `Backend returned ${res.status}` };
    }

    const data = (await res.json()) as { narrative?: string };
    if (!data.narrative) {
      return { plan, usedBedrock: false, error: "No narrative returned" };
    }

    // Defense-in-depth: even though the backend enforces the no-classification
    // guardrail, re-check client-side and fall back to the local narrative on
    // any violation rather than display it.
    if (!clientNarrativeIsSafe(data.narrative)) {
      return { plan, usedBedrock: false, error: "Narrative failed local safety check" };
    }

    return {
      plan: { ...plan, narrative: data.narrative, narrativeSource: "bedrock" },
      usedBedrock: true,
    };
  } catch (err) {
    return {
      plan,
      usedBedrock: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
