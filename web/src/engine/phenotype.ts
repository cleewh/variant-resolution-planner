// ---------------------------------------------------------------------------
// Phenotype-similarity engine.
//
// This makes the patient's HPO terms FUNCTIONAL rather than decorative: it
// compares them against the terms expected for the candidate gene/disease and
// produces a phenotype-fit score, which the planner uses to derive the
// phenotype evidence status and to surface "expected but not yet observed"
// terms worth checking on deeper phenotyping.
//
// IMPORTANT: the knowledge base below is a small, SYNTHETIC, illustrative map
// for the demo genes only. A production system would compute semantic
// similarity against real gene-phenotype annotations (HPO annotations / OMIM /
// Orphanet) using the ontology graph (ancestors, information content), e.g. an
// Exomiser/Phenomizer-style algorithm. This exact-match-with-weights approach
// is a transparent stand-in for the concept, not a real similarity engine.
// ---------------------------------------------------------------------------

import type { HpoTerm, PhenotypeMatch, VariantCase } from "./types";

interface GeneProfile {
  label: string;
  /** Highly expected ("core") features — weighted 1.0. */
  core: HpoTerm[];
  /** Supportive/less specific features — weighted 0.5. */
  supportive: HpoTerm[];
}

/** Synthetic, illustrative gene → expected-phenotype map (demo genes only). */
export const GENE_PHENOTYPE: Record<string, GeneProfile> = {
  MYH7: {
    label: "MYH7-associated cardiomyopathy",
    core: [
      { id: "HP:0001639", name: "Hypertrophic cardiomyopathy" },
      { id: "HP:0001712", name: "Left ventricular hypertrophy" },
    ],
    supportive: [
      { id: "HP:0001645", name: "Sudden cardiac death" },
      { id: "HP:0001644", name: "Dilated cardiomyopathy" },
    ],
  },
  GENEX: {
    label: "synthetic GENEX neurodevelopmental disorder",
    core: [
      { id: "HP:0001250", name: "Seizure" },
      { id: "HP:0001263", name: "Global developmental delay" },
    ],
    supportive: [{ id: "HP:0002376", name: "Developmental regression" }],
  },
  GENEZ: {
    label: "synthetic GENEZ metabolic disorder",
    core: [
      { id: "HP:0001250", name: "Seizure" },
      { id: "HP:0001263", name: "Global developmental delay" },
      { id: "HP:0001252", name: "Hypotonia" },
      { id: "HP:0003128", name: "Lactic acidosis" },
    ],
    supportive: [],
  },
  GENEW: {
    label: "synthetic GENEW disorder",
    core: [{ id: "HP:0000407", name: "Sensorineural hearing impairment" }],
    supportive: [{ id: "HP:0001250", name: "Seizure" }],
  },
};

const CORE_WEIGHT = 1.0;
const SUPPORTIVE_WEIGHT = 0.5;

export function scorePhenotypeMatch(c: VariantCase): PhenotypeMatch | null {
  // Prefer REAL HPO gene->phenotype annotations when they have been fetched.
  if (c.liveHpoPhenotypes && c.liveHpoPhenotypes.length > 0) {
    return scoreAgainstLiveHpo(c);
  }

  const profile = GENE_PHENOTYPE[c.gene];
  if (!profile) return null; // unknown gene: no synthetic profile available

  const patientIds = new Set(c.patient.hpoTerms.map((t) => t.id));
  const expected = [...profile.core, ...profile.supportive];
  const expectedIds = new Set(expected.map((t) => t.id));

  const matchedCore = profile.core.filter((t) => patientIds.has(t.id));
  const matchedSupportive = profile.supportive.filter((t) => patientIds.has(t.id));
  const matched = [...matchedCore, ...matchedSupportive];

  const expectedMissing = expected.filter((t) => !patientIds.has(t.id));
  const unexplained = c.patient.hpoTerms.filter((t) => !expectedIds.has(t.id));

  const totalWeight =
    profile.core.length * CORE_WEIGHT + profile.supportive.length * SUPPORTIVE_WEIGHT;
  const matchedWeight =
    matchedCore.length * CORE_WEIGHT + matchedSupportive.length * SUPPORTIVE_WEIGHT;
  const score = totalWeight > 0 ? Math.round((matchedWeight / totalWeight) * 100) / 100 : 0;

  let level: PhenotypeMatch["level"] =
    score >= 0.8 ? "strong" : score >= 0.45 ? "partial" : "poor";

  // Temper the fit when a large share of the patient's reported features are not
  // typical of this gene (suggests under-fit, or a possible second diagnosis).
  const patientCount = c.patient.hpoTerms.length;
  const unexplainedFraction = patientCount > 0 ? unexplained.length / patientCount : 0;
  const tempered = unexplainedFraction >= 0.5;
  if (tempered) {
    level = level === "strong" ? "partial" : "poor";
  }

  const missingNames = expectedMissing.map((t) => t.name).join(", ");
  const unexplainedSuffix =
    unexplained.length > 0
      ? ` ${unexplained.length} reported feature(s) are not typical of this gene${
          tempered ? ", which tempers the fit and may point to a second diagnosis" : ""
        }.`
      : "";
  const note =
    level === "strong"
      ? `Phenotype strongly overlaps ${profile.label} (synthetic HPO match ${score}).${unexplainedSuffix}`
      : level === "partial"
      ? `Phenotype partially overlaps ${profile.label} (synthetic HPO match ${score})${
          missingNames ? `; expected but not yet observed: ${missingNames}` : ""
        }.${unexplainedSuffix}`
      : `Phenotype overlaps ${profile.label} weakly (synthetic HPO match ${score}); consider whether this gene explains the presentation and/or broaden the differential.${unexplainedSuffix}`;

  return {
    gene: c.gene,
    diseaseLabel: profile.label,
    score,
    level,
    matched,
    expectedMissing,
    unexplained,
    note,
    source: "synthetic-map",
    expectedCount: expected.length,
  };
}

/**
 * Precision-style match against the REAL HPO gene-phenotype union. The union
 * spans all diseases linked to the gene and is large, so we score how many of
 * the patient's reported terms are among the gene's known associations
 * (coverage of the patient's terms), rather than recall of the whole union.
 * NOTE: this is exact-term matching without the ontology graph; a child term
 * of a known association will not match, so treat it as a floor, not a ceiling.
 */
function scoreAgainstLiveHpo(c: VariantCase): PhenotypeMatch {
  const expected = c.liveHpoPhenotypes ?? [];
  const expectedIds = new Set(expected.map((t) => t.id));
  const patient = c.patient.hpoTerms;

  const matched = patient.filter((t) => expectedIds.has(t.id));
  const unexplained = patient.filter((t) => !expectedIds.has(t.id));
  const score = patient.length > 0 ? Math.round((matched.length / patient.length) * 100) / 100 : 0;
  const level: PhenotypeMatch["level"] =
    score >= 0.8 ? "strong" : score >= 0.45 ? "partial" : "poor";

  const label = c.liveDiseases && c.liveDiseases.length > 0
    ? `${c.gene}-associated phenotypes (HPO; e.g. ${c.liveDiseases[0].name})`
    : `${c.gene}-associated phenotypes (HPO)`;

  const unexplainedSuffix =
    unexplained.length > 0
      ? ` ${unexplained.length} reported term(s) are not among the gene's HPO associations (note: exact-term match without the ontology graph, so related child terms may be undercounted).`
      : "";
  const note = `${matched.length} of ${patient.length} reported HPO term(s) are among ${expected.length} known ${c.gene} phenotype associations (HPO, live).${unexplainedSuffix}`;

  return {
    gene: c.gene,
    diseaseLabel: label,
    score,
    level,
    matched,
    expectedMissing: [], // union too large to enumerate usefully
    unexplained,
    note,
    source: "live-hpo",
    expectedCount: expected.length,
  };
}
