// ---------------------------------------------------------------------------
// Amazon Bedrock explanation layer.
//
// The deterministic engine (shared with the frontend) already produces the
// full plan: scores, ranking, drivers, and a local narrative. This module asks
// Bedrock ONLY to rewrite that narrative into fluent prose. It must not
// classify the variant, must not assign ACMG criteria, and must not invent new
// recommendations.
//
// Uses the Converse API (unified across models) with maxTokens set explicitly
// (leaving it unset silently over-reserves quota and can cause throttling).
// ---------------------------------------------------------------------------

import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";

const REGION = process.env.AWS_REGION || process.env.BEDROCK_REGION || "us-east-1";

// Cross-region inference profile ID (the "us." prefix) is used for higher
// availability. Override with BEDROCK_MODEL_ID. Verify availability in your
// account/region with:  aws bedrock list-inference-profiles --region <region>
const MODEL_ID =
  process.env.BEDROCK_MODEL_ID || "us.anthropic.claude-3-5-sonnet-20241022-v2:0";

const MAX_TOKENS = Number(process.env.BEDROCK_MAX_TOKENS || 600);

const client = new BedrockRuntimeClient({ region: REGION });

const SYSTEM_PROMPT = `You are assisting a genomics evidence-planning prototype. You are given a structured "Variant Resolution Plan" that has already been computed deterministically.

Your ONLY job is to write a concise, clear narrative (2 to 3 short paragraphs) summarising the plan for an expert reviewer.

Strict rules:
- Do NOT classify the variant. Do NOT say it is pathogenic, likely pathogenic, benign, or suggest changing the classification.
- Do NOT assign or reference specific ACMG/AMP criteria codes.
- Do NOT invent new recommendations. Only summarise the actions and reasoning provided.
- Use careful, non-committal language: "could contribute to", "may be informative", "depending on expert evaluation".
- Emphasise WHY the top action is prioritised and note that low-value actions are unlikely to add independent information.
- Do not reveal step-by-step reasoning. Provide only the final summary prose.
- Keep it professional and grounded. No headings, no bullet lists, no markdown.`;

interface PlanForPrompt {
  classification?: string;
  recommended?: { title?: string; whyItMatters?: string; informationValueLabel?: string } | null;
  rankedActions?: Array<{ title?: string; priority?: string; informationValueLabel?: string }>;
  lowValueActions?: Array<{ title?: string; lowValueReason?: string }>;
  evidenceGaps?: Array<{ label?: string }>;
  strongestInformation?: Array<{ label?: string }>;
}

interface CaseForPrompt {
  gene?: string;
  variant?: { hgvs?: string; type?: string };
  patient?: { suspectedDisease?: string };
  inheritanceModel?: string;
}

function buildUserMessage(variantCase: CaseForPrompt, plan: PlanForPrompt): string {
  const gaps = (plan.evidenceGaps || []).map((g) => g.label).filter(Boolean);
  const strong = (plan.strongestInformation || []).map((g) => g.label).filter(Boolean);
  const ranked = (plan.rankedActions || []).map(
    (a) => `${a.title} (priority ${a.priority}, info value ${a.informationValueLabel})`
  );
  const low = (plan.lowValueActions || []).map(
    (a) => `${a.title} — ${a.lowValueReason}`
  );

  return [
    `Gene / variant: ${variantCase.gene} ${variantCase.variant?.hgvs} (${variantCase.variant?.type})`,
    `Assumed inheritance model: ${variantCase.inheritanceModel ?? "unspecified"}`,
    `Suspected disease: ${variantCase.patient?.suspectedDisease}`,
    `Current classification (do not change): ${plan.classification}`,
    `Strongest existing information: ${strong.join(", ") || "none recorded"}`,
    `Important evidence gaps: ${gaps.join(", ") || "none"}`,
    `Highest-value next action: ${plan.recommended?.title || "none"} — ${plan.recommended?.whyItMatters || ""}`,
    `Ranked actions: ${ranked.join("; ") || "none"}`,
    `Low-value actions: ${low.join("; ") || "none"}`,
    ``,
    `Write the narrative summary now.`,
  ].join("\n");
}

/**
 * Anti-classification guardrail. The tool's core safety claim is that it does
 * NOT classify variants or give medical advice. This checks the model output
 * for classification/management language that would violate that claim. On a
 * violation we reject the narrative so the client falls back to the deterministic
 * local narrative.
 */
// The negative lookahead excludes the tool's own hedged, bidirectional wording
// ("benign-direction", "pathogenic-leaning") so legitimate narratives are not
// wrongly rejected. We target ASSERTED classification tiers and treatment advice,
// not the mere words "classification"/"diagnosis" (which appear in safe
// meta-statements like "does not change the classification" or "the differential
// diagnosis").
const NOT_DIRECTION = String.raw`(?!\s*[-\u2013]\s*(direction|leaning))`;
const FORBIDDEN_PATTERNS: RegExp[] = [
  // Asserted classification tiers.
  new RegExp(String.raw`\blikely\s+(pathogenic|benign)\b${NOT_DIRECTION}`, "i"),
  new RegExp(
    String.raw`\b(is|are|was|were|be|being|remains?|deemed|considered)\s+(most\s+)?(likely\s+)?(pathogenic|benign)\b${NOT_DIRECTION}`,
    "i"
  ),
  // Reclassification / tier movement.
  /\bre-?classif\w*/i,
  /\b(upgrade|downgrade)\s+(to\b|the\s+classification|this\s+variant)/i,
  /\bshould\s+be\s+(classified|reclassified|considered\s+(likely\s+)?(pathogenic|benign))\b/i,
  // Treatment / medical advice.
  /\b(prescrib(e|ing)|start(ing)?\s+(a\s+)?(medication|treatment)|treat\s+the\s+patient)\b/i,
  /\bwe\s+recommend\s+(treating|starting|prescribing)\b/i,
];

export function validateNarrative(text: string): { ok: boolean; reason?: string } {
  for (const re of FORBIDDEN_PATTERNS) {
    const m = re.exec(text);
    if (m) {
      return { ok: false, reason: `Output contained disallowed phrasing near "${m[0]}"` };
    }
  }
  return { ok: true };
}

export class NarrativeGuardrailError extends Error {}

export async function generateNarrative(
  variantCase: CaseForPrompt,
  plan: PlanForPrompt
): Promise<string> {
  const command = new ConverseCommand({
    modelId: MODEL_ID,
    system: [{ text: SYSTEM_PROMPT }],
    messages: [
      {
        role: "user",
        content: [{ text: buildUserMessage(variantCase, plan) }],
      },
    ],
    inferenceConfig: {
      maxTokens: MAX_TOKENS, // set explicitly — see Bedrock quota mechanics
      temperature: 0.3,
    },
  });

  const response = await client.send(command);
  const text = response.output?.message?.content
    ?.map((block) => ("text" in block ? block.text : ""))
    .join("")
    .trim();

  if (!text) {
    throw new Error("Bedrock returned an empty narrative");
  }

  const check = validateNarrative(text);
  if (!check.ok) {
    // Do not return output that breaches the no-classification safety claim.
    throw new NarrativeGuardrailError(check.reason ?? "Guardrail violation");
  }
  return text;
}

export const bedrockConfig = { REGION, MODEL_ID, MAX_TOKENS };
