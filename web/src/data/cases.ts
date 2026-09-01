import type { VariantCase } from "../engine/types";

const SYNTHETIC_NOTICE =
  "Synthetic demonstration variant. Not a real patient case. No real genomic or clinical data is used.";

/**
 * Demo case 1 — hypertrophic cardiomyopathy, MYH7 missense VUS.
 * Designed so that family segregation is the strongest next step and
 * additional computational predictors are explicitly low value.
 */
export const cardiomyopathyCase: VariantCase = {
  id: "demo-mvh7-hcm",
  title: "Hypertrophic cardiomyopathy — MYH7 missense VUS",
  synthetic: true,
  syntheticNotice: SYNTHETIC_NOTICE,
  patient: {
    ageDescription: "17-year-old",
    summary:
      "17-year-old with hypertrophic cardiomyopathy and left ventricular hypertrophy. Family history of cardiomyopathy. No known syndromic features.",
    suspectedDisease: "Hypertrophic cardiomyopathy (sarcomeric)",
    hpoTerms: [
      { id: "HP:0001639", name: "Hypertrophic cardiomyopathy" },
      { id: "HP:0001712", name: "Left ventricular hypertrophy" },
      { id: "HP:0001645", name: "Sudden cardiac death" },
    ],
  },
  gene: "MYH7",
  geneDiseaseValidity: "definitive",
  diseasePrevalence: "common", // HCM ~1:500
  rnaTissueAccessible: false, // cardiac gene not expressed in blood/fibroblast
  variant: {
    hgvs: "c.2699A>G p.(Asp900Gly)",
    type: "missense",
    zygosity: "Heterozygous",
    zygosityCategory: "heterozygous",
    orthogonallyConfirmed: true,
    predictedSpliceImpact: false,
    spliceProximity: "distant",
    notes:
      "Explicitly fictional / synthetic MYH7 missense variant used for demonstration only.",
  },
  inheritance: "Consistent with autosomal dominant (family history present)",
  inheritanceModel: "autosomal-dominant",
  family: {
    historyPresent: true,
    summary:
      "Affected father with cardiomyopathy; unaffected older maternal relatives available. Parents available for testing.",
    parentsAvailable: true,
    affectedRelativesAvailable: true,
    unaffectedRelativesAvailable: true,
    parentageConfirmed: true,
    consanguinity: false,
    informativeMeioses: 4,
  },
  classification: "VUS",
  evidence: {
    population: {
      status: "present",
      detail: "Rare / absent in population reference datasets.",
    },
    phenotype: {
      status: "present",
      detail:
        "Phenotype compatible with MYH7-associated hypertrophic cardiomyopathy.",
    },
    segregation: {
      status: "absent",
      detail: "No segregation data on file; family members not yet tested.",
    },
    deNovo: {
      status: "absent",
      detail: "De novo status not assessed; family history suggests inherited.",
    },
    molecular: {
      status: "notApplicable",
      detail:
        "Dominant single-variant hypothesis; biallelic (second-allele/phase) completeness is not applicable.",
    },
    functional: {
      status: "absent",
      detail: "No functional evidence available.",
    },
    rnaSplicing: {
      status: "notApplicable",
      detail: "Missense change, distant from splice sites, without a predicted splicing consequence.",
    },
    caseLevel: {
      status: "absent",
      detail: "No independent published case evidence supplied.",
    },
    computational: {
      status: "present",
      detail:
        "Multiple in-silico missense predictors already considered (results mixed).",
    },
  },
  testsPerformed: [
    "Diagnostic gene panel (cardiomyopathy)",
    "Population frequency lookup",
    "In-silico missense prediction",
  ],
  notes:
    "Proband identified on a cardiomyopathy panel. Cascade testing has not yet been initiated.",
};

/**
 * Demo case 2 — suspected splice-altering variant.
 * Designed so that RNA analysis outranks additional computational prediction,
 * showing that recommendations follow the mechanism.
 */
export const spliceCase: VariantCase = {
  id: "demo-splice-mendelian",
  title: "Suspected splice-altering variant — Mendelian disorder",
  synthetic: true,
  syntheticNotice: SYNTHETIC_NOTICE,
  patient: {
    ageDescription: "9-year-old",
    summary:
      "9-year-old with a phenotype compatible with a recessive Mendelian disorder. A rare variant near an exon/intron junction is the leading candidate.",
    suspectedDisease: "Synthetic autosomal recessive Mendelian disorder",
    hpoTerms: [
      { id: "HP:0001250", name: "Seizure" },
      { id: "HP:0001263", name: "Global developmental delay" },
      { id: "HP:0002376", name: "Developmental regression" },
    ],
  },
  gene: "GENEX",
  geneDiseaseValidity: "unknown",
  diseasePrevalence: "rare",
  rnaTissueAccessible: true,
  variant: {
    hgvs: "c.1234+3A>G (intron 9 splice region)",
    type: "splice-region",
    zygosity: "Heterozygous (second variant sought)",
    zygosityCategory: "compound-het-pending",
    orthogonallyConfirmed: false,
    predictedSpliceImpact: true,
    spliceProximity: "splice-region",
    notes:
      "Explicitly fictional / synthetic splice-region variant used for demonstration only.",
  },
  inheritance: "Possible autosomal recessive; phase not yet established",
  inheritanceModel: "autosomal-recessive",
  family: {
    historyPresent: false,
    summary:
      "No clear family history. Parents available. Segregation currently inconclusive.",
    parentsAvailable: true,
    affectedRelativesAvailable: false,
    unaffectedRelativesAvailable: true,
    parentageConfirmed: true,
    consanguinity: false,
  },
  molecularCompleteness: {
    secondAlleleIdentified: false,
    phaseEstablished: false,
    cnvStructuralAssessed: false,
  },
  classification: "VUS",
  evidence: {
    population: {
      status: "present",
      detail: "Rare in population reference datasets.",
    },
    phenotype: {
      status: "present",
      detail: "Phenotype compatible with the gene-associated disorder.",
    },
    segregation: {
      status: "partial",
      detail: "Segregation inconclusive; phase not yet established.",
    },
    deNovo: {
      status: "absent",
      detail: "De novo status not assessed.",
    },
    molecular: {
      status: "absent",
      detail:
        "Only one variant identified; second (trans) allele, phase, and CNV/structural not yet established.",
    },
    functional: {
      status: "absent",
      detail: "No functional evidence available.",
    },
    rnaSplicing: {
      status: "absent",
      detail:
        "Splicing effect predicted in-silico but not tested at the RNA/transcript level.",
    },
    caseLevel: {
      status: "absent",
      detail: "No independent case evidence supplied.",
    },
    computational: {
      status: "present",
      detail: "Splice predictors already run; suggest a possible effect.",
    },
  },
  testsPerformed: [
    "Exome sequencing",
    "In-silico splice prediction",
    "Population frequency lookup",
  ],
  notes:
    "A predicted splice consequence has not been confirmed at the transcript level.",
};

/**
 * Demo case 3 — consanguineous, homozygous recessive VUS.
 * Designed so the plan leads with confirming true homozygosity (excluding a
 * hemizygous deletion) and homozygosity/ROH mapping, showing that zygosity and
 * consanguinity change the plan.
 */
export const consanguineousCase: VariantCase = {
  id: "demo-consang-homozygous",
  title: "Consanguineous recessive — homozygous VUS",
  synthetic: true,
  syntheticNotice: SYNTHETIC_NOTICE,
  patient: {
    ageDescription: "4-year-old",
    summary:
      "4-year-old, offspring of first-cousin parents, with a phenotype compatible with a recessive metabolic/neurodevelopmental disorder. A rare homozygous missense variant is the leading candidate.",
    suspectedDisease: "Synthetic autosomal recessive metabolic disorder",
    hpoTerms: [
      { id: "HP:0001250", name: "Seizure" },
      { id: "HP:0001252", name: "Hypotonia" },
      { id: "HP:0001263", name: "Global developmental delay" },
    ],
  },
  gene: "GENEZ",
  geneDiseaseValidity: "moderate",
  diseasePrevalence: "rare",
  rnaTissueAccessible: true,
  variant: {
    hgvs: "c.845T>C p.(Leu282Pro)",
    type: "missense",
    zygosity: "Homozygous",
    zygosityCategory: "homozygous",
    orthogonallyConfirmed: true,
    predictedSpliceImpact: false,
    spliceProximity: "distant",
    notes:
      "Explicitly fictional / synthetic homozygous missense variant used for demonstration only.",
  },
  inheritance: "Autosomal recessive; parents are first cousins",
  inheritanceModel: "autosomal-recessive",
  family: {
    historyPresent: false,
    summary:
      "Consanguineous union (first cousins). One affected child; healthy sibling. Parents available.",
    parentsAvailable: true,
    affectedRelativesAvailable: false,
    unaffectedRelativesAvailable: true,
    parentageConfirmed: true,
    consanguinity: true,
  },
  molecularCompleteness: {
    // Homozygous, so a "second allele" is the same variant — but structural
    // variation has NOT been excluded (apparent homozygosity could be hemizygous).
    secondAlleleIdentified: true,
    phaseEstablished: true,
    cnvStructuralAssessed: false,
  },
  classification: "VUS",
  evidence: {
    population: { status: "present", detail: "Rare / absent in population reference datasets." },
    phenotype: {
      status: "partial",
      detail: "Phenotype broadly compatible but not yet deeply characterised.",
    },
    segregation: {
      status: "partial",
      detail: "Consistent with recessive inheritance in a consanguineous pedigree; not formally established.",
    },
    deNovo: { status: "notApplicable", detail: "Recessive/biallelic hypothesis." },
    molecular: {
      status: "partial",
      detail:
        "Homozygous call, but a hemizygous deletion has not been excluded and ROH not yet analysed.",
    },
    functional: { status: "absent", detail: "No functional evidence available." },
    rnaSplicing: { status: "notApplicable", detail: "Missense change without predicted splicing consequence." },
    caseLevel: { status: "absent", detail: "No independent case evidence supplied." },
    computational: { status: "present", detail: "In-silico missense predictors already considered." },
  },
  testsPerformed: [
    "Trio exome sequencing",
    "Population frequency lookup",
    "In-silico missense prediction",
  ],
  notes:
    "Homozygous candidate in a consanguineous family; true homozygosity vs hemizygous deletion not yet resolved.",
};

/**
 * Demo case 4 — a deliberately hard case where the VUS may not be resolvable
 * with current resources: no informative family, evidence already exhausted,
 * a well-established gene. Shows the honest "may remain a VUS" resolvability
 * state and an incremental-only plan.
 */
export const limitedResolutionCase: VariantCase = {
  id: "demo-limited-resolution",
  title: "Limited-resolution VUS — no informative family, evidence exhausted",
  synthetic: true,
  syntheticNotice: SYNTHETIC_NOTICE,
  patient: {
    ageDescription: "52-year-old",
    summary:
      "52-year-old adopted individual (no biological relatives available) with a mild, nonspecific phenotype compatible with a rare autosomal dominant disorder. Extensive workup already performed.",
    suspectedDisease: "Synthetic rare autosomal dominant disorder",
    hpoTerms: [
      { id: "HP:0001250", name: "Seizure" },
      { id: "HP:0000407", name: "Sensorineural hearing impairment" },
    ],
  },
  gene: "GENEW",
  geneDiseaseValidity: "definitive",
  diseasePrevalence: "rare",
  rnaTissueAccessible: true,
  variant: {
    hgvs: "c.1580G>A p.(Arg527His)",
    type: "missense",
    zygosity: "Heterozygous",
    zygosityCategory: "heterozygous",
    orthogonallyConfirmed: true,
    predictedSpliceImpact: false,
    spliceProximity: "distant",
    notes: "Explicitly fictional / synthetic missense variant used for demonstration only.",
  },
  inheritance: "Suspected autosomal dominant; isolated case, no family available",
  inheritanceModel: "autosomal-dominant",
  family: {
    historyPresent: false,
    summary:
      "Adopted; no biological relatives available for testing. Parents unavailable. No family history obtainable.",
    parentsAvailable: false,
    affectedRelativesAvailable: false,
    unaffectedRelativesAvailable: false,
    parentageConfirmed: false,
    consanguinity: false,
  },
  classification: "VUS",
  evidence: {
    population: { status: "present", detail: "Rare / absent in population reference datasets." },
    phenotype: { status: "present", detail: "Phenotype compatible with the gene-associated disorder." },
    segregation: { status: "absent", detail: "No relatives available; segregation cannot be pursued." },
    deNovo: { status: "unavailable", detail: "Parents unavailable; de novo status cannot be established." },
    molecular: { status: "notApplicable", detail: "Dominant single-variant hypothesis." },
    functional: {
      status: "contradictory",
      detail:
        "A functional assay was performed and showed no clearly abnormal effect on the tested readout (requires expert appraisal of assay validity).",
    },
    rnaSplicing: { status: "notApplicable", detail: "Missense change, distant from splice sites." },
    caseLevel: {
      status: "saturated",
      detail: "Literature/case databases searched exhaustively; no additional independent observations found.",
    },
    computational: { status: "present", detail: "Multiple in-silico predictors already considered." },
  },
  testsPerformed: [
    "Diagnostic exome sequencing",
    "Orthogonal (Sanger) confirmation",
    "Exhaustive literature / ClinVar review",
    "In-silico prediction",
    "Functional assay (no clear effect)",
  ],
  notes:
    "Evidence largely exhausted with no informative family; realistic expectation is that this may remain a VUS pending future reanalysis.",
};

/**
 * Demo case 5 — a REAL variant for live knowledgebase lookup.
 *
 * MYH7 c.5287G>A p.(Ala1763Thr) — rs727504355, ClinVar Variation ID 177846,
 * a genuine variant classified "Uncertain significance" by multiple submitters.
 * The clinical context around it is synthetic, but the variant identifiers are
 * real: clicking "Fetch live annotations" retrieves live gnomAD frequency,
 * ClinVar assertions, dbNSFP predictors, and MYH7 HPO phenotype associations.
 *
 * Evidence fields start "absent/notApplicable" and are populated from live data
 * on fetch (with provenance badges).
 */
export const realMyh7Case: VariantCase = {
  id: "real-myh7-vus",
  title: "REAL variant — MYH7 p.(Ala1763Thr) VUS (live lookup)",
  synthetic: true,
  syntheticNotice:
    "The VARIANT is real (rs727504355 / ClinVar 177846) for live-database demonstration; the surrounding clinical scenario is synthetic. Not a real patient case.",
  patient: {
    ageDescription: "Adult",
    summary:
      "Synthetic clinical context: an adult with features suggestive of hypertrophic cardiomyopathy. Used to demonstrate live retrieval of real gnomAD/ClinVar/dbNSFP/HPO data for a genuine MYH7 VUS.",
    suspectedDisease: "Hypertrophic cardiomyopathy (sarcomeric)",
    hpoTerms: [
      { id: "HP:0001639", name: "Hypertrophic cardiomyopathy" },
      { id: "HP:0011675", name: "Arrhythmia" },
      { id: "HP:0001645", name: "Sudden cardiac death" },
    ],
  },
  gene: "MYH7",
  entrezId: "4625",
  geneDiseaseValidity: "definitive",
  diseasePrevalence: "common",
  rnaTissueAccessible: false,
  variant: {
    hgvs: "NM_000257.4:c.5287G>A p.(Ala1763Thr)",
    type: "missense",
    zygosity: "Heterozygous",
    zygosityCategory: "heterozygous",
    orthogonallyConfirmed: true,
    predictedSpliceImpact: false,
    spliceProximity: "distant",
    genomicId: "chr14:g.23415267C>T",
    rsId: "rs727504355",
    proteinChange: "p.(Ala1763Thr)",
    notes: "Real MYH7 VUS used to demonstrate live knowledgebase integration.",
  },
  inheritance: "Consistent with autosomal dominant",
  inheritanceModel: "autosomal-dominant",
  family: {
    historyPresent: true,
    summary: "Synthetic family context: reported family history; relatives potentially available.",
    parentsAvailable: true,
    affectedRelativesAvailable: true,
    unaffectedRelativesAvailable: true,
    parentageConfirmed: true,
    consanguinity: false,
  },
  classification: "VUS",
  evidence: {
    population: { status: "absent", detail: "Not yet fetched — click 'Fetch live annotations'." },
    phenotype: { status: "present", detail: "Phenotype compatible with MYH7-associated cardiomyopathy." },
    segregation: { status: "absent", detail: "No segregation data on file." },
    deNovo: { status: "absent", detail: "De novo status not assessed." },
    molecular: { status: "notApplicable", detail: "Dominant single-variant hypothesis." },
    functional: { status: "absent", detail: "No functional evidence available." },
    rnaSplicing: { status: "notApplicable", detail: "Missense change, distant from splice sites." },
    caseLevel: { status: "absent", detail: "Not yet fetched — click 'Fetch live annotations'." },
    computational: { status: "absent", detail: "Not yet fetched — click 'Fetch live annotations'." },
  },
  testsPerformed: ["Diagnostic gene panel (cardiomyopathy)"],
  notes:
    "Real MYH7 VUS (rs727504355 / ClinVar 177846). Use live lookup to populate population, computational, and case-level evidence from real databases.",
};

export const DEMO_CASES: VariantCase[] = [
  cardiomyopathyCase,
  spliceCase,
  consanguineousCase,
  limitedResolutionCase,
  realMyh7Case,
];

// --- "Add New Evidence" presets --------------------------------------------

export interface EvidencePreset {
  id: string;
  label: string;
  description: string;
  /** Returns a NEW case object with the added evidence applied. */
  apply: (c: VariantCase) => VariantCase;
}

function clone(c: VariantCase): VariantCase {
  return JSON.parse(JSON.stringify(c)) as VariantCase;
}

export const EVIDENCE_PRESETS: EvidencePreset[] = [
  {
    id: "affected-mother-carries",
    label: "Affected mother carries the variant",
    description:
      "A first-degree affected relative is now known to carry the variant, providing partial segregation evidence.",
    apply: (c) => {
      const next = clone(c);
      next.evidence.segregation = {
        status: "partial",
        detail:
          "Affected mother confirmed to carry the variant. Partial segregation established; further relatives could add discrimination.",
      };
      next.family.summary = `${next.family.summary} Update: affected mother tested and carries the variant.`;
      next.testsPerformed.push("Maternal cascade test (variant present, mother affected)");
      next.notes = `${next.notes ?? ""} New evidence: affected mother carries the variant.`.trim();
      return next;
    },
  },
  {
    id: "rna-abnormal-transcript",
    label: "RNA analysis shows an abnormal transcript",
    description:
      "RNA/transcript analysis demonstrates an abnormal transcript, providing a new functional/splicing evidence category.",
    apply: (c) => {
      const next = clone(c);
      next.evidence.rnaSplicing = {
        status: "present",
        detail:
          "RNA analysis demonstrates an abnormal transcript consistent with a splicing consequence.",
      };
      next.evidence.functional = {
        status: "partial",
        detail:
          "Transcript-level effect observed; broader functional consequence still uncharacterised.",
      };
      next.testsPerformed.push("RNA / transcript analysis (abnormal transcript observed)");
      next.notes = `${next.notes ?? ""} New evidence: RNA analysis shows an abnormal transcript.`.trim();
      return next;
    },
  },
  {
    id: "functional-no-effect",
    label: "Functional assay shows no detectable effect",
    description:
      "A functional assay demonstrates no detectable effect, creating new (potentially contradictory) evidence.",
    apply: (c) => {
      const next = clone(c);
      next.evidence.functional = {
        status: "contradictory",
        detail:
          "Functional assay demonstrates no detectable effect on the tested readout. This may point against a damaging mechanism and requires expert appraisal of assay validity.",
      };
      next.testsPerformed.push("Functional assay (no detectable effect)");
      next.notes = `${next.notes ?? ""} New evidence: functional assay shows no detectable effect.`.trim();
      return next;
    },
  },
  {
    id: "second-allele-trans",
    label: "Second (trans) allele identified",
    description:
      "A second pathogenic allele is found in trans (e.g. a deletion detected on CNV analysis), completing the biallelic explanation for a recessive hypothesis.",
    apply: (c) => {
      const next = clone(c);
      next.molecularCompleteness = {
        secondAlleleIdentified: true,
        phaseEstablished: true,
        cnvStructuralAssessed: true,
      };
      next.evidence.molecular = {
        status: "present",
        detail:
          "Second allele identified in trans (CNV/structural analysis); phase confirmed via parental testing. Biallelic explanation now complete.",
      };
      next.testsPerformed.push("CNV / structural analysis (second allele in trans identified)");
      next.notes = `${next.notes ?? ""} New evidence: second allele identified in trans.`.trim();
      return next;
    },
  },
  {
    id: "cnv-excluded-homozygous",
    label: "Hemizygous deletion excluded (true homozygosity)",
    description:
      "CNV/structural analysis confirms true homozygosity (no overlapping deletion on the other allele), completing the molecular picture for a homozygous candidate.",
    apply: (c) => {
      const next = clone(c);
      next.molecularCompleteness = {
        secondAlleleIdentified: true,
        phaseEstablished: true,
        cnvStructuralAssessed: true,
      };
      next.evidence.molecular = {
        status: "present",
        detail:
          "CNV/structural analysis excludes a hemizygous deletion; the homozygous genotype is confirmed genuine.",
      };
      next.testsPerformed.push("CNV / structural analysis (hemizygous deletion excluded)");
      next.notes = `${next.notes ?? ""} New evidence: true homozygosity confirmed (no hemizygous deletion).`.trim();
      return next;
    },
  },
  {
    id: "segregation-full",
    label: "Variant segregates with disease in the family",
    description:
      "The variant tracks with disease across multiple informative relatives, largely resolving the segregation question.",
    apply: (c) => {
      const next = clone(c);
      next.evidence.segregation = {
        status: "present",
        detail:
          "Variant observed in multiple affected relatives and absent in tested unaffected relatives. Segregation evidence now available for expert review.",
      };
      next.testsPerformed.push("Extended family cascade testing (co-segregation observed)");
      next.notes = `${next.notes ?? ""} New evidence: variant co-segregates with disease.`.trim();
      return next;
    },
  },
];
