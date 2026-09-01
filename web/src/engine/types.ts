// ---------------------------------------------------------------------------
// Domain types for the Variant Resolution Planner
//
// These types describe a genomic case and the structured output of the
// evidence-gap reasoning engine. The engine is intentionally deterministic:
// scoring and ranking are computed from the structured case, and natural
// language explanations are layered on top (locally by template, or optionally
// enhanced by an LLM such as Amazon Bedrock).
//
// This is a RESEARCH / DEMONSTRATION prototype. It does not classify variants
// and does not provide clinical advice.
// ---------------------------------------------------------------------------

/** A Human Phenotype Ontology term. */
export interface HpoTerm {
  id: string; // e.g. "HP:0001639"
  name: string; // e.g. "Hypertrophic cardiomyopathy"
}

export type VariantType =
  | "missense"
  | "splice-region"
  | "nonsense"
  | "frameshift"
  | "in-frame-indel"
  | "synonymous"
  | "other";

/**
 * The eight broad evidence categories the planner reasons across.
 * Kept deliberately generic so the tool never maps 1:1 onto ACMG codes.
 */
export type EvidenceCategoryKey =
  | "population"
  | "phenotype"
  | "segregation"
  | "deNovo"
  | "molecular" // molecular completeness: second allele / phase (esp. recessive)
  | "functional"
  | "rnaSplicing"
  | "caseLevel"
  | "computational";

/**
 * Gap keys used by actions. A superset of the evidence categories that adds
 * "meta" gaps which are not tracked per-case in EvidenceState:
 *  - technical:    is the variant call itself validated (orthogonal confirmation)?
 *  - geneValidity: is the gene-disease relationship valid / is reanalysis due?
 */
export type GapKey =
  | EvidenceCategoryKey
  | "technical" // orthogonal confirmation of the call
  | "geneValidity" // gene-disease validity / reanalysis
  | "inheritanceModel" // establishing the mode of inheritance (e.g. trio)
  | "mosaicism" // parental / somatic mosaicism
  | "domain" // protein domain / mutational hotspot
  | "differential"; // alternative gene / genome reanalysis

/** Structured zygosity / allelic state of the variant in the proband. */
export type ZygosityCategory =
  | "heterozygous"
  | "homozygous"
  | "hemizygous"
  | "compound-het-pending" // one variant found, a second allele is being sought
  | "unknown";

/** Approximate prevalence of the suspected disorder (drives frequency thresholds). */
export type DiseasePrevalence = "rare" | "moderate" | "common" | "unknown";

/**
 * A coarse indication of how much a positive/negative result from an action
 * could move interpretation, echoing ACMG strength tiers without asserting them.
 */
export type PotentialStrength =
  | "could be decisive"
  | "moderate"
  | "supporting"
  | "context";

/**
 * Assumed mode of inheritance for the working hypothesis. This drives how the
 * planner reasons about segregation, de novo status, and molecular completeness.
 */
export type InheritanceModel =
  | "autosomal-dominant"
  | "autosomal-recessive"
  | "x-linked"
  | "de-novo-dominant"
  | "unknown";

/** ClinGen-style gene-disease validity of the working gene-disease pair. */
export type GeneDiseaseValidity =
  | "definitive"
  | "strong"
  | "moderate"
  | "limited"
  | "unknown";

/**
 * Status of a single evidence category for a case.
 * - present:      informative evidence exists in this category
 * - partial:      some evidence exists but it is incomplete or inconclusive
 * - absent:       no evidence yet, but it is potentially obtainable
 * - saturated:    enough evidence of this type already considered; more adds little
 * - unavailable:  cannot realistically be obtained for this case
 * - contradictory:evidence exists that points against the current hypothesis
 * - notApplicable:not relevant to this variant / mechanism
 */
export type EvidenceStatus =
  | "present"
  | "partial"
  | "absent"
  | "saturated"
  | "unavailable"
  | "contradictory"
  | "notApplicable";

export interface EvidenceCategory {
  status: EvidenceStatus;
  detail: string;
  /** Provenance when populated from a live knowledgebase (e.g. "gnomAD (live)"). */
  source?: string;
  /** ISO timestamp of the live retrieval, if applicable. */
  retrievedAt?: string;
}

export type EvidenceState = Record<EvidenceCategoryKey, EvidenceCategory>;

export interface FamilyContext {
  historyPresent: boolean;
  summary: string;
  parentsAvailable: boolean;
  affectedRelativesAvailable: boolean;
  unaffectedRelativesAvailable: boolean;
  /** Parentage confirmed by genetic testing (prerequisite for de novo / PS2). */
  parentageConfirmed?: boolean;
  /** Known/suspected consanguinity (raises prior for homozygosity by descent). */
  consanguinity?: boolean;
  /** Number of informative meioses available for co-segregation analysis. */
  informativeMeioses?: number;
}

/**
 * Whether the molecular explanation is complete. Most relevant for a recessive
 * (biallelic) hypothesis where a single heterozygous variant is not sufficient.
 */
export interface MolecularCompleteness {
  secondAlleleIdentified: boolean;
  phaseEstablished: boolean; // are the two variants confirmed in trans?
  cnvStructuralAssessed: boolean; // has deletion/duplication/structural been ruled out?
}

/** The structured case object. This is the single source of truth. */
export interface VariantCase {
  id: string;
  title: string;
  synthetic: boolean;
  syntheticNotice: string;

  patient: {
    ageDescription: string;
    summary: string;
    hpoTerms: HpoTerm[];
    suspectedDisease: string;
  };

  gene: string;
  /** NCBI Gene id for live HPO lookup (optional; resolved from symbol otherwise). */
  entrezId?: string;
  geneDiseaseValidity?: GeneDiseaseValidity;
  /** Approximate prevalence of the suspected disorder (frequency-threshold context). */
  diseasePrevalence?: DiseasePrevalence;
  /** Real gene->phenotype terms fetched live from HPO (used by the matcher). */
  liveHpoPhenotypes?: HpoTerm[];
  /** Real gene->disease associations fetched live from HPO. */
  liveDiseases?: { id: string; name: string }[];
  /** gnomAD gene-level constraint (from live lookup). */
  geneConstraint?: { pli?: number; loeuf?: number; misZ?: number; note: string };
  /** Compact live-annotation facts for display, with provenance. */
  liveContext?: { label: string; value: string; source: string }[];
  /** Is the gene expressed in an accessible tissue for RNA study (else minigene)? */
  rnaTissueAccessible?: boolean;
  variant: {
    hgvs: string;
    type: VariantType;
    zygosity: string; // free-text, for display
    zygosityCategory?: ZygosityCategory; // structured, drives reasoning
    notes?: string;
    /** Identifiers enabling live knowledgebase lookup. */
    genomicId?: string; // MyVariant genomic id, e.g. "chr14:g.23415267C>T" (hg38)
    rsId?: string; // dbSNP rsID
    proteinChange?: string; // e.g. "p.(Ala1763Thr)"
    /** Whether the residue lies in a UniProt-annotated functional domain (from live lookup). */
    inCriticalDomain?: boolean;
    criticalDomainName?: string;
    /** Orthogonally confirmed (e.g. Sanger) as a true call. */
    orthogonallyConfirmed?: boolean;
    /** In-silico splice signal (e.g. SpliceAI) regardless of consequence type. */
    predictedSpliceImpact?: boolean;
    /** Position relative to the nearest splice site. */
    spliceProximity?:
      | "canonical" // +/- 1,2 canonical dinucleotide
      | "splice-region" // within the splice region
      | "exonic-near-boundary" // exonic but close to a junction (ESE/ESS territory)
      | "distant" // away from any splice site
      | "na";
  };

  inheritance: string; // free-text, for display
  inheritanceModel: InheritanceModel; // structured, drives reasoning
  family: FamilyContext;
  /** Present when a biallelic/recessive hypothesis is in play. */
  molecularCompleteness?: MolecularCompleteness;

  classification: string; // e.g. "VUS" — never changed by the engine
  evidence: EvidenceState;
  testsPerformed: string[];
  notes?: string;
}

// --- Reasoning output ------------------------------------------------------

export type LevelLabel = "Low" | "Medium" | "Medium-High" | "High";
export type PriorityLabel = "High" | "Medium" | "Low" | "Not recommended";

/** The transparent, prototype scoring factors for a candidate action. */
export interface ScoreFactors {
  informationValue: number; // 1..5 expected discriminatory value
  independence: number; // 1..5 how novel a category of evidence
  relevance: number; // 1..5 biological appropriateness for this variant/mechanism
  feasibility: number; // 1..5 can the evidence realistically be obtained
  effort: number; // 1..5 difficulty / cost (higher = harder)
}

/**
 * Which direction the evidence could move the interpretation. The tool is
 * deliberately bidirectional: some actions can support a benign-direction
 * reassessment, not only a pathogenic-direction one.
 */
export type EvidenceDirection = "either" | "supporting" | "refuting" | "neutral";

export interface RankedAction {
  id: string;
  title: string;
  gapAddressed: string; // human label of the evidence gap
  gapKey: GapKey;

  priority: PriorityLabel;
  informationValueLabel: LevelLabel;
  effortLabel: LevelLabel;
  direction: EvidenceDirection;
  /**
   * Coarse indication of how decisively a result could move interpretation IF
   * obtained (magnitude, independent of effort). Derived deterministically from
   * the score factors — this is a different axis from `priority`/`score`, which
   * measure expected information gain per unit effort. A decisive action can be
   * lower priority when it is costly.
   */
  potentialStrength?: PotentialStrength;
  /** Should be done before committing to high-effort investigations. */
  prerequisite?: boolean;
  /** Sequencing guidance (e.g. "do after prerequisites / cheaper evidence"). */
  sequencingNote?: string;
  /** Short, cited note grounding the reasoning in a published framework. */
  evidenceBasis?: string;
  /** Clinical-care / counselling caveat (e.g. cascade testing is care, not just evidence). */
  clinicalCaveat?: string;

  factors: ScoreFactors;
  score: number; // prototype prioritization score

  informationGained: string; // what uncertainty this addresses
  whyItMatters: string; // biological / interpretive rationale
  potentialEvidenceImpact: string; // careful, non-committal evidence language
  drivers: string[]; // specific case facts driving this recommendation
  suggestedIndividuals?: string[]; // for segregation-type actions
  lowValue: boolean;
  lowValueReason?: string;
}

export interface EvidenceSnapshotItem {
  key: EvidenceCategoryKey;
  label: string;
  status: EvidenceStatus;
  detail: string;
}

/** Result of comparing the patient's HPO terms to the gene's expected phenotype. */
export interface PhenotypeMatch {
  gene: string;
  diseaseLabel: string;
  score: number; // 0..1 similarity
  level: "strong" | "partial" | "poor";
  matched: HpoTerm[]; // patient terms that are expected for the gene
  expectedMissing: HpoTerm[]; // expected terms not seen in the patient
  unexplained: HpoTerm[]; // patient terms outside the gene's expected set
  note: string;
  /** live-hpo = real HPO gene annotations; synthetic-map = illustrative demo map. */
  source: "live-hpo" | "synthetic-map";
  /** Number of expected terms considered (large for the live HPO union). */
  expectedCount: number;
}

export interface ResolutionPlan {
  caseId: string;
  caseTitle: string;
  classification: string;

  strongestInformation: EvidenceSnapshotItem[];
  evidenceGaps: EvidenceSnapshotItem[];
  contradictoryOrSaturated: EvidenceSnapshotItem[];

  recommended: RankedAction | null; // the single highest-value next action
  rankedActions: RankedAction[]; // recommended actions in priority order
  lowValueActions: RankedAction[]; // explicitly de-prioritized actions

  /** Phenotype-fit derived from the patient's HPO terms (null if gene unknown). */
  phenotypeMatch: PhenotypeMatch | null;

  /** Honest expectation-setting: is this VUS realistically resolvable now? */
  resolvability: {
    level: "likely" | "constrained" | "limited";
    summary: string;
  };
  /** Sequencing guidance across the whole plan (prerequisites, ordering). */
  sequencingNote?: string;
  /** How to read the scores (prototype, not calibrated). */
  methodologyNote: string;

  /**
   * Optional narrative summary. Produced locally by template, or replaced /
   * enhanced by an LLM (e.g. Amazon Bedrock) when a backend is configured.
   */
  narrative: string;
  narrativeSource: "local" | "bedrock";
}
