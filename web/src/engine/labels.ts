import type { EvidenceCategoryKey, GapKey, EvidenceStatus } from "./types";

export const CATEGORY_LABELS: Record<EvidenceCategoryKey, string> = {
  population: "Population frequency",
  phenotype: "Phenotype fit",
  segregation: "Segregation / inheritance",
  deNovo: "De novo status",
  molecular: "Molecular completeness (2nd allele / phase)",
  functional: "Functional evidence",
  rnaSplicing: "RNA / splicing effect",
  caseLevel: "Independent case-level evidence",
  computational: "Computational predictions",
};

/** Superset of CATEGORY_LABELS including action-only "meta" gaps. */
export const GAP_LABELS: Record<GapKey, string> = {
  ...CATEGORY_LABELS,
  technical: "Technical / orthogonal confirmation",
  geneValidity: "Gene-disease validity / reanalysis",
  inheritanceModel: "Inheritance model (trio)",
  mosaicism: "Mosaicism",
  domain: "Protein domain / hotspot",
  differential: "Differential / genome reanalysis",
};

export const STATUS_LABELS: Record<EvidenceStatus, string> = {
  present: "Present",
  partial: "Partial",
  absent: "Missing",
  saturated: "Already considered",
  unavailable: "Not obtainable",
  contradictory: "Contradictory",
  notApplicable: "Not applicable",
};

/** Semantic class used for colour-coding chips in the UI. */
export const STATUS_TONE: Record<EvidenceStatus, string> = {
  present: "tone-good",
  partial: "tone-partial",
  absent: "tone-gap",
  saturated: "tone-neutral",
  unavailable: "tone-neutral",
  contradictory: "tone-warn",
  notApplicable: "tone-muted",
};
