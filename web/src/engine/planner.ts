// ---------------------------------------------------------------------------
// The planner orchestrates the deterministic reasoning:
//   1. Summarise the current evidence (strongest info / gaps / saturated).
//   2. Generate candidate actions and score them.
//   3. Rank, assign priority labels, and split out low-value actions.
//   4. Produce a local narrative summary (optionally replaced by Bedrock).
//
// It never changes the classification and never assigns ACMG criteria.
// ---------------------------------------------------------------------------

import type {
  EvidenceCategoryKey,
  EvidenceSnapshotItem,
  PriorityLabel,
  RankedAction,
  ResolutionPlan,
  VariantCase,
} from "./types";
import { CATEGORY_LABELS } from "./labels";
import { ACTION_GENERATORS } from "./actions";
import { scorePhenotypeMatch } from "./phenotype";
import type { EvidenceStatus } from "./types";

const CATEGORY_ORDER: EvidenceCategoryKey[] = [
  "population",
  "phenotype",
  "segregation",
  "deNovo",
  "molecular",
  "functional",
  "rnaSplicing",
  "caseLevel",
  "computational",
];

function snapshot(c: VariantCase): {
  strongest: EvidenceSnapshotItem[];
  gaps: EvidenceSnapshotItem[];
  contradictoryOrSaturated: EvidenceSnapshotItem[];
} {
  const strongest: EvidenceSnapshotItem[] = [];
  const gaps: EvidenceSnapshotItem[] = [];
  const contradictoryOrSaturated: EvidenceSnapshotItem[] = [];

  for (const key of CATEGORY_ORDER) {
    const cat = c.evidence[key];
    const item: EvidenceSnapshotItem = {
      key,
      label: CATEGORY_LABELS[key],
      status: cat.status,
      detail: cat.detail,
    };
    if (cat.status === "present") strongest.push(item);
    else if (cat.status === "partial") strongest.push(item);
    else if (cat.status === "absent") gaps.push(item);
    else if (cat.status === "contradictory" || cat.status === "saturated")
      contradictoryOrSaturated.push(item);
    // unavailable / notApplicable are intentionally omitted from the headline snapshot
  }

  return { strongest, gaps, contradictoryOrSaturated };
}

function assignPriority(a: RankedAction): PriorityLabel {
  if (a.lowValue) return "Not recommended";
  if (a.score >= 100) return "High";
  if (a.score >= 35) return "Medium";
  return "Low";
}

export function buildResolutionPlan(input: VariantCase): ResolutionPlan {
  // Make the HPO terms functional: derive the phenotype-fit status from a
  // phenotype-similarity match where a gene profile exists, so it drives the
  // downstream reasoning instead of being an unused, hand-set value.
  const phenotypeMatch = scorePhenotypeMatch(input);
  const c: VariantCase = phenotypeMatch
    ? {
        ...input,
        evidence: {
          ...input.evidence,
          phenotype: {
            status: phenotypeStatusFromMatch(phenotypeMatch.level),
            detail: phenotypeMatch.note,
          },
        },
      }
    : input;

  const { strongest, gaps, contradictoryOrSaturated } = snapshot(c);

  const actions = ACTION_GENERATORS.map((gen) => gen(c))
    .filter((a): a is NonNullable<typeof a> => a !== null)
    .map((a) => ({ ...a, priority: assignPriority(a) }));

  // Sort by score, highest first. Low-value actions naturally fall to the bottom.
  actions.sort((x, y) => y.score - x.score);

  const rankedActions = actions.filter((a) => !a.lowValue);
  const lowValueActions = actions
    .filter((a) => a.lowValue)
    .sort((x, y) => y.score - x.score);

  const recommended = rankedActions.length > 0 ? rankedActions[0] : null;

  const plan: ResolutionPlan = {
    caseId: c.id,
    caseTitle: c.title,
    classification: c.classification,
    strongestInformation: strongest,
    evidenceGaps: gaps,
    contradictoryOrSaturated,
    recommended,
    rankedActions,
    lowValueActions,
    phenotypeMatch,
    resolvability: assessResolvability(rankedActions),
    sequencingNote: buildSequencingNote(rankedActions),
    methodologyNote: METHODOLOGY_NOTE,
    narrative: buildLocalNarrative(c, recommended, rankedActions, gaps, phenotypeMatch),
    narrativeSource: "local",
  };

  return plan;
}

function phenotypeStatusFromMatch(level: "strong" | "partial" | "poor"): EvidenceStatus {
  if (level === "strong") return "present";
  if (level === "partial") return "partial";
  // A weak overlap on an exact-match synthetic score reflects under-fit or
  // under-coding, NOT a genuine phenotype-gene conflict. Treat it as "absent"
  // (evidence not yet established), never as "contradictory".
  return "absent";
}

const METHODOLOGY_NOTE =
  "Prioritisation uses a transparent prototype score (information value x independence x relevance x feasibility / effort). 'Priority' measures expected information gain per unit effort; 'potential impact' measures how decisively a result could move interpretation if obtained — a decisive action can still be low priority when costly. Factor weights are informed by, but NOT formally calibrated to, published frameworks (ACMG/AMP, Richards et al. 2015; Bayesian ACMG points, Tavtigian et al. 2018; ClinGen SVI functional and segregation calibrations; gnomAD-based frequency thresholds). Treat scores as a prioritisation aid, not a validated metric.";

/** Honest expectation-setting: is this VUS realistically resolvable now? */
function assessResolvability(
  ranked: RankedAction[]
): ResolutionPlan["resolvability"] {
  const decisive = ranked.filter((a) => a.potentialStrength === "could be decisive");
  const feasibleDecisive = decisive.filter((a) => a.factors.feasibility >= 4);

  if (feasibleDecisive.length > 0) {
    return {
      level: "likely",
      summary: `This VUS looks potentially resolvable with current resources: the most decisive next step ("${feasibleDecisive[0].title}") is both high-impact and feasible.`,
    };
  }
  if (decisive.length > 0) {
    return {
      level: "constrained",
      summary: `Resolution is possible but constrained: the most decisive step ("${decisive[0].title}") currently has limited feasibility (e.g. it needs samples, tissue, or an assay that is not yet available). Prioritise obtaining what would make it feasible; otherwise progress will be incremental.`,
    };
  }
  return {
    level: "limited",
    summary:
      "Realistically, this variant may remain a VUS with current resources: the available next steps are incremental rather than decisive. Consider periodic reanalysis over time and set expectations with the requesting clinician accordingly.",
  };
}

/** Surface prerequisite/ordering guidance across the plan. */
function buildSequencingNote(ranked: RankedAction[]): string | undefined {
  const prereq = ranked.find((a) => a.prerequisite);
  const highEffort = ranked.find((a) => a.effortLabel === "High");
  if (prereq && highEffort) {
    return `Sequence the plan: complete "${prereq.title}" first (a low-cost prerequisite) before committing to high-effort work such as "${highEffort.title}". These are listed together by efficiency, but they are not independent — an unconfirmed or artefactual finding would waste the expensive steps.`;
  }
  if (prereq) {
    return `"${prereq.title}" is a low-cost prerequisite — complete it before investing in more involved investigations.`;
  }
  return undefined;
}

function buildLocalNarrative(
  c: VariantCase,
  recommended: RankedAction | null,
  ranked: RankedAction[],
  gaps: EvidenceSnapshotItem[],
  phenotypeMatch: ResolutionPlan["phenotypeMatch"]
): string {
  const gapNames = gaps.map((g) => g.label.toLowerCase()).slice(0, 4);
  const lines: string[] = [];

  const modelLabel: Record<string, string> = {
    "autosomal-dominant": "an autosomal dominant",
    "autosomal-recessive": "an autosomal recessive (biallelic)",
    "x-linked": "an X-linked",
    "de-novo-dominant": "a de novo dominant",
    unknown: "an as-yet-unresolved",
  };

  lines.push(
    `${c.gene} ${c.variant.hgvs} is currently classified as ${c.classification}, under ${modelLabel[c.inheritanceModel] ?? "an"} inheritance model. This plan organises what evidence would most efficiently reduce the remaining uncertainty; it does not reinterpret the classification.`
  );

  if (phenotypeMatch) {
    if (phenotypeMatch.level === "strong") {
      lines.push(
        `The reported HPO terms fit ${phenotypeMatch.diseaseLabel} well (synthetic phenotype match ${phenotypeMatch.score}).`
      );
    } else if (phenotypeMatch.level === "partial") {
      const missing = phenotypeMatch.expectedMissing.map((t) => t.name).join(", ");
      lines.push(
        `The reported HPO terms fit ${phenotypeMatch.diseaseLabel} only partially (synthetic phenotype match ${phenotypeMatch.score})${
          missing ? `; features such as ${missing} are expected but not yet reported, which deeper phenotyping could check` : ""
        }.`
      );
    } else {
      lines.push(
        `The reported HPO terms fit ${phenotypeMatch.diseaseLabel} poorly (synthetic phenotype match ${phenotypeMatch.score}), which weakens the hypothesis that this gene explains the presentation.`
      );
    }
  }

  if (gapNames.length > 0) {
    lines.push(
      `The most notable current evidence gaps are ${gapNames.join(", ")}.`
    );
  }

  if (recommended) {
    lines.push(
      `The highest-value next action is "${recommended.title}" (expected information value: ${recommended.informationValueLabel}). ${recommended.whyItMatters}`
    );
  }

  const second = ranked[1];
  if (second) {
    lines.push(
      `A reasonable parallel step is "${second.title}", which is low effort and addresses a different evidence category.`
    );
  }

  lines.push(
    "Evidence is considered bidirectionally: some actions could support a benign-direction reassessment, not only a pathogenic one. All items are candidate next steps for expert review; the tool prioritises information gain rather than simply listing every possible test."
  );

  return lines.join(" ");
}
