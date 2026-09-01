// ---------------------------------------------------------------------------
// AWS Lambda handler (Lambda Function URL, payload format v2).
//
// Exposes POST /explain -> { narrative }.
// The deterministic plan is computed on the client; this endpoint only adds a
// Bedrock-generated narrative. On any Bedrock error it returns 502 so the
// client can fall back to its local narrative.
// ---------------------------------------------------------------------------

import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";
import { generateNarrative, NarrativeGuardrailError } from "./bedrock";
import { fetchAnnotation, type AnnotateInput } from "./annotate";

// For a public demo Function URL the allowed origin defaults to "*". Restrict
// this via ALLOWED_ORIGIN in production deployments.
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

function cors(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Content-Type": "application/json",
  };
}

function json(
  statusCode: number,
  body: unknown
): APIGatewayProxyStructuredResultV2 {
  return { statusCode, headers: cors(), body: JSON.stringify(body) };
}

export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> {
  const method = event.requestContext?.http?.method || "POST";
  const path = event.rawPath || "/";

  if (method === "OPTIONS") {
    return { statusCode: 204, headers: cors(), body: "" };
  }

  if (method === "GET" && (path === "/" || path === "/health")) {
    return json(200, { status: "ok", service: "variant-resolution-planner-api" });
  }

  // Live annotation from real knowledgebases (gnomAD/ClinVar/dbNSFP + HPO).
  if (method === "POST" && path.endsWith("/annotate")) {
    let body: AnnotateInput;
    try {
      body = event.body ? (JSON.parse(event.body) as AnnotateInput) : {};
    } catch {
      return json(400, { error: "Invalid JSON body" });
    }
    if (!body.gene && !body.genomicId && !body.rsId && !body.entrezId) {
      return json(400, { error: "Provide at least one of: gene, genomicId, rsId, entrezId" });
    }
    try {
      const annotation = await fetchAnnotation(body);
      return json(200, annotation);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Annotation error";
      return json(502, { error: "Annotation failed", detail: message });
    }
  }

  if (method !== "POST" || !path.endsWith("/explain")) {
    return json(404, { error: "Not found" });
  }

  let parsed: { case?: unknown; plan?: unknown };
  try {
    parsed = event.body ? JSON.parse(event.body) : {};
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  if (!parsed.case || !parsed.plan) {
    return json(400, { error: "Body must include 'case' and 'plan'" });
  }

  try {
    // Treat client-provided content as untrusted input for prompt construction.
    const narrative = await generateNarrative(parsed.case as never, parsed.plan as never);
    return json(200, { narrative, source: "bedrock" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bedrock error";
    if (err instanceof NarrativeGuardrailError) {
      // Output breached the no-classification safety guardrail; reject it so the
      // client falls back to the deterministic local narrative.
      return json(422, { error: "Narrative failed safety guardrail", detail: message });
    }
    // 502 signals the client to fall back to its local narrative.
    return json(502, { error: "Bedrock enhancement failed", detail: message });
  }
}
