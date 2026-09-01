// ---------------------------------------------------------------------------
// Candidate action generation + transparent (prototype) scoring.
//
// Two SEPARATE axes are surfaced per action:
//   - priority / score : expected information gain PER UNIT EFFORT
//                        = (informationValue x independence x relevance x feasibility) / effort
//   - potentialStrength: how decisively a result could move interpretation IF
//                        obtained (magnitude, effort-independent). Derived
//                        deterministically from the same factors so the two axes
//                        cannot arbitrarily contradict. A decisive action can
//                        still be low priority when it is costly.
//
// Reasoning branches on the assumed mode of inheritance AND structured zygosity.
// The exact numbers are NOT calibrated; weights are informed by (not validated
// against) published frameworks — see `evidenceBasis` per action and the
// methodology note in the plan.
// ---------------------------------------------------------------------------

import type {
  EvidenceDirection,
  LevelLabel,
  PotentialStrength,
  RankedAction,
  ScoreFactors,
  VariantCase,
  ZygosityCategory,
} from "./types";
import { GAP_LABELS } from "./labels";

export function computeScore(f: ScoreFactors): number {
  const raw =
    (f.informationValue * f.independence * f.relevance * f.feasibility) /
    Math.max(1, f.effort);
  return Math.round(raw * 10) / 10;
}

function infoValueLabel(v: number): LevelLabel {
  if (v >= 4.5) return "High";
  if (v >= 3.5) return "Medium-High";
  if (v >= 2.5) return "Medium";
  return "Low";
}

function effortLabel(v: number): LevelLabel {
  if (v <= 2) return "Low";
  if (v === 3) return "Medium";
  return "High";
}

/**
 * Potential strength is the effort-INDEPENDENT magnitude of a result, derived
 * from information value x independence x relevance. Neutral-direction actions
 * (prerequisites/technical) are always "context".
 */
function derivePotentialStrength(
  f: ScoreFactors,
  direction: EvidenceDirection
): PotentialStrength {
  if (direction === "neutral") return "context";
  const decisiveness = f.informationValue * f.independence * f.relevance;
  if (decisiveness >= 60) return "could be decisive";
  if (decisiveness >= 30) return "moderate";
  if (decisiveness >= 12) return "supporting";
  return "context";
}

type Draft = Omit<
  RankedAction,
  | "score"
  | "priority"
  | "informationValueLabel"
  | "effortLabel"
  | "gapAddressed"
  | "potentialStrength"
>;

function finalize(d: Draft): RankedAction {
  return {
    ...d,
    gapAddressed: GAP_LABELS[d.gapKey],
    score: computeScore(d.factors),
    informationValueLabel: infoValueLabel(d.factors.informationValue),
    effortLabel: effortLabel(d.factors.effort),
    potentialStrength: derivePotentialStrength(d.factors, d.direction),
    priority: "Low", // assigned later by the planner
  };
}

const CASCADE_CAVEAT =
  "Cascade/family testing is also clinical care for relatives: it requires informed consent and genetic counselling, and carrier or affected results carry surveillance and psychosocial implications. Relatives are not only a source of evidence.";

const SEG_BASIS =
  "Co-segregation modelled as a likelihood ratio (ClinGen SVI; Jarvik & Browning, 2016); strength scales with the number of informative meioses.";

function zygosity(c: VariantCase): ZygosityCategory {
  return c.variant.zygosityCategory ?? "unknown";
}

// --- individual action generators ------------------------------------------

function familySegregation(c: VariantCase): RankedAction | null {
  const seg = c.evidence.segregation.status;
  const fam = c.family;
  const phenotypeStrong =
    c.evidence.phenotype.status === "present" ||
    c.evidence.phenotype.status === "partial";
  const relativesAvailable =
    fam.affectedRelativesAvailable || fam.unaffectedRelativesAvailable;

  // ----- Recessive (biallelic) hypothesis --------------------------------
  if (c.inheritanceModel === "autosomal-recessive") {
    const informationValue = fam.affectedRelativesAvailable ? 3 : 2;
    const feasibility = fam.parentsAvailable || relativesAvailable ? 4.5 : 1.5;

    const suggested: string[] = [];
    if (fam.affectedRelativesAvailable)
      suggested.push("Affected sibling(s) — expected to carry the same biallelic genotype");
    if (fam.parentsAvailable)
      suggested.push("Both parents — each expected to be a heterozygous carrier (also establishes phase)");
    suggested.push("Note: unaffected siblings may be heterozygous carriers and are not informative for presence/absence of disease");

    const drivers: string[] = [
      "Recessive (biallelic) hypothesis: segregation is assessed as carrier status and trans configuration, not dominant co-segregation",
    ];
    if (fam.parentsAvailable) drivers.push("Parents available for carrier testing / phasing");
    if (fam.affectedRelativesAvailable) drivers.push("Affected relative(s) available to check for the same genotype");
    if (seg === "partial") drivers.push("Segregation currently inconclusive");

    const lowValue = feasibility <= 1.5;
    return finalize({
      id: "family-segregation",
      title: "Family carrier testing & genotype concordance (recessive)",
      gapKey: "segregation",
      direction: "either",
      evidenceBasis: SEG_BASIS,
      factors: { informationValue, independence: 3, relevance: 3.5, feasibility, effort: 2 },
      informationGained:
        "Whether both parents are carriers and whether affected relatives share the same biallelic genotype.",
      whyItMatters:
        "For a recessive hypothesis the discriminating question is biallelic status and phase, not dominant co-segregation. Confirming carrier parents and concordant genotypes in affected relatives supports the model; discordance can weaken it.",
      potentialEvidenceImpact:
        "Could contribute inheritance-related context for expert review, depending on carrier status and genotype concordance across relatives.",
      drivers,
      suggestedIndividuals: suggested,
      clinicalCaveat: CASCADE_CAVEAT,
      lowValue,
      lowValueReason: lowValue
        ? "No informative relatives appear to be available for carrier/genotype testing."
        : undefined,
    });
  }

  // ----- X-linked --------------------------------------------------------
  if (c.inheritanceModel === "x-linked") {
    const maternalInfo = fam.parentsAvailable || fam.affectedRelativesAvailable;
    let informationValue = 3;
    if (seg === "absent") informationValue = maternalInfo ? 4.5 : 3;
    else if (seg === "partial") informationValue = 3;
    else if (seg === "present") informationValue = 1.5;

    const relevance = fam.historyPresent ? 4.5 : 3.5;
    const feasibility = maternalInfo ? 5 : 2;

    const suggested: string[] = [
      "Mother — carrier testing (and X-inactivation considerations)",
      "Affected males on the maternal lineage (maternal uncles, brothers)",
      "Note: male-to-male transmission argues AGAINST X-linkage; the maternal side is informative",
    ];

    const drivers: string[] = [
      "X-linked hypothesis: segregation follows a sex-specific pattern (carrier females, affected males, no male-to-male transmission)",
      "Assumes X-linked RECESSIVE; X-linked dominant (often affected females, possible male lethality) shows a different pattern — confirm the sub-type",
    ];
    if (fam.parentsAvailable) drivers.push("Mother available for carrier testing");
    if (seg === "absent") drivers.push("No segregation data on file");

    const lowValue = seg === "present" || (feasibility <= 2 && !maternalInfo);
    return finalize({
      id: "family-segregation",
      title: "X-linked segregation (maternal lineage)",
      gapKey: "segregation",
      direction: "either",
      evidenceBasis: SEG_BASIS,
      factors: { informationValue, independence: seg === "present" ? 2 : 4.5, relevance, feasibility, effort: 2 },
      informationGained:
        "Whether the variant tracks with disease along the maternal lineage in a sex-consistent X-linked pattern.",
      whyItMatters:
        "X-linked segregation is not generic co-segregation: it is assessed through carrier females and affected males on the maternal side, with no male-to-male transmission. Consistency (or inconsistency) with this pattern is informative in either direction.",
      potentialEvidenceImpact:
        "Could contribute inheritance-pattern context for expert review; sex-specific transmission and X-inactivation require expert interpretation.",
      drivers,
      suggestedIndividuals: suggested,
      clinicalCaveat: CASCADE_CAVEAT,
      lowValue,
      lowValueReason: lowValue
        ? seg === "present"
          ? "Segregation evidence already gathered; further testing likely confirmatory."
          : "Maternal-lineage relatives do not appear available for informative X-linked segregation."
        : undefined,
    });
  }

  // ----- Dominant-like / unknown: co-segregation -------------------------
  const modelUnknown = c.inheritanceModel === "unknown";
  let informationValue = 2;
  if (seg === "absent") informationValue = relativesAvailable ? 5 : 3;
  else if (seg === "partial") informationValue = 3;
  else if (seg === "present") informationValue = 1.5;
  if (modelUnknown) informationValue = Math.min(informationValue, 4);

  // Scale by the number of informative meioses where known.
  const meioses = fam.informativeMeioses;
  if (typeof meioses === "number") {
    if (meioses >= 6) informationValue = Math.min(5, informationValue + 0.5);
    else if (meioses <= 2) informationValue = Math.max(1.5, informationValue - 1);
  }

  const independence = seg === "present" ? 2 : seg === "partial" ? 3 : 5;
  const relevance =
    fam.historyPresent && phenotypeStrong ? 5 : fam.historyPresent ? 4 : 2.5;
  const feasibility =
    fam.parentsAvailable || relativesAvailable ? 5 : fam.historyPresent ? 3 : 1;

  const suggested: string[] = [];
  if (fam.affectedRelativesAvailable)
    suggested.push("Affected first-degree relative(s) sharing the phenotype (e.g. affected parent or sibling)");
  if (fam.unaffectedRelativesAvailable)
    suggested.push("Older unaffected relatives — informative only if past the typical age of onset (see penetrance note)");
  if (fam.parentsAvailable)
    suggested.push("Parents (to establish phase and whether the variant is inherited or de novo)");
  if (suggested.length === 0)
    suggested.push("Any consenting relatives with known affected/unaffected status");

  const drivers: string[] = [];
  if (fam.historyPresent) drivers.push("Positive family history of the condition");
  if (fam.affectedRelativesAvailable) drivers.push("Affected relative(s) reported as available for testing");
  if (fam.unaffectedRelativesAvailable) drivers.push("Unaffected relatives potentially available");
  if (typeof meioses === "number") drivers.push(`~${meioses} informative meioses reported (co-segregation strength scales with this)`);
  if (seg === "absent") drivers.push("No segregation data currently on file");
  else if (seg === "partial") drivers.push("Only partial segregation data available so far");
  if (phenotypeStrong) drivers.push("Phenotype overlaps the disease associated with the candidate gene");
  if (modelUnknown) drivers.push("Inheritance model unresolved — see 'establish inheritance model' action");

  const lowValue = seg === "present" || feasibility <= 1;
  const lowValueReason = lowValue
    ? seg === "present"
      ? "Segregation evidence has already been gathered; further family testing is likely to be confirmatory rather than newly informative."
      : "No family members appear to be available, so segregation testing is not currently feasible."
    : undefined;

  return finalize({
    id: "family-segregation",
    title: "Targeted family segregation testing",
    gapKey: "segregation",
    direction: "either",
    evidenceBasis: SEG_BASIS,
    factors: { informationValue, independence, relevance, feasibility, effort: 2 },
    informationGained:
      "Whether the variant tracks with the phenotype across affected and unaffected relatives.",
    whyItMatters:
      "In a family with a suggestive history, observing whether the variant co-occurs with disease across relatives is one of the more discriminating pieces of information obtainable. Co-segregation strength accrues slowly (many informative meioses are needed) and age-related or incomplete penetrance means unaffected younger relatives are only weakly informative.",
    potentialEvidenceImpact:
      "Depending on the observed pattern across informative relatives and subsequent expert evaluation, this could contribute to segregation-related evidence (in either direction). It does not by itself satisfy any specific criterion.",
    drivers,
    suggestedIndividuals: suggested,
    clinicalCaveat: CASCADE_CAVEAT,
    lowValue,
    lowValueReason,
  });
}

function establishInheritanceModel(c: VariantCase): RankedAction | null {
  if (c.inheritanceModel !== "unknown") return null;

  const parents = c.family.parentsAvailable;
  return finalize({
    id: "establish-inheritance-model",
    title: "Establish the inheritance model (trio / duo analysis)",
    gapKey: "inheritanceModel",
    direction: "either",
    evidenceBasis:
      "Trio analysis classifies de novo vs inherited vs biallelic; inheritance classification reframes which downstream evidence is worth pursuing.",
    factors: { informationValue: 4.5, independence: 4, relevance: 5, feasibility: parents ? 5 : 2.5, effort: 2 },
    informationGained:
      "Whether the variant is de novo, inherited (and from which parent), or part of a biallelic genotype — i.e. which inheritance model applies.",
    whyItMatters:
      "When the mode of inheritance is unresolved, most downstream reasoning (segregation, de novo, second-allele) is model-dependent. Trio (or duo) analysis is usually the single most clarifying next step and reframes the entire plan.",
    potentialEvidenceImpact:
      "Could establish the inheritance pattern for expert review, which reframes which subsequent evidence is worth pursuing.",
    drivers: [
      "Inheritance model currently recorded as unknown",
      parents ? "Parental samples available for trio analysis" : "Parental samples would be required for trio analysis",
    ],
    clinicalCaveat:
      "Trio testing requires parental consent and confirmed parentage; incidental findings and non-paternity are counselling considerations.",
    lowValue: false,
  });
}

const SECOND_ALLELE_VUS_CAVEAT =
  "A second allele found in trans may itself be a VUS: a two-variants-in-trans genotype then needs its own appraisal (phase confirmation, in-trans co-occurrence, and interpretation of the second variant).";

function secondAllelePhase(c: VariantCase): RankedAction | null {
  if (!(c.inheritanceModel === "autosomal-recessive" || c.inheritanceModel === "unknown"))
    return null;
  const mc = c.molecularCompleteness;
  if (!mc) return null;
  const zyg = zygosity(c);

  const MOLECULAR_BASIS =
    "Recessive disorders require biallelic pathogenic variants (ACMG/AMP); CNV/structural analysis and phasing establish molecular completeness.";

  // ----- Homozygous: confirm true homozygosity vs hemizygous deletion -----
  if (zyg === "homozygous") {
    if (mc.cnvStructuralAssessed) {
      return finalize({
        id: "second-allele-phase",
        title: "Confirm true homozygosity (CNV already excluded)",
        gapKey: "molecular",
        direction: "either",
        evidenceBasis: MOLECULAR_BASIS,
        factors: { informationValue: 1.6, independence: 2, relevance: 3, feasibility: 5, effort: 2 },
        informationGained: "Whether the apparent homozygosity is genuine.",
        whyItMatters:
          "Structural variation has already been assessed, so the homozygous genotype appears genuine and the molecular explanation is plausibly complete.",
        potentialEvidenceImpact: "Molecular completeness already largely established.",
        drivers: ["Homozygous genotype reported", "CNV / structural variation already assessed"],
        lowValue: true,
        lowValueReason:
          "Homozygosity with structural variation already excluded; the biallelic explanation is plausibly complete.",
      });
    }
    return finalize({
      id: "second-allele-phase",
      title: "Confirm true homozygosity — exclude a hemizygous deletion",
      gapKey: "molecular",
      direction: "either",
      evidenceBasis: MOLECULAR_BASIS,
      factors: { informationValue: 4.5, independence: 4, relevance: 5, feasibility: 4.5, effort: 2 },
      informationGained:
        "Whether the variant is truly homozygous, or a heterozygous SNV over an overlapping deletion (apparent homozygosity / hemizygous).",
      whyItMatters:
        "An apparently homozygous variant can be a single SNV unmasked by an overlapping deletion on the other allele (hemizygosity). Confirming true homozygosity (CNV/structural analysis, parental dosage) versus a hemizygous deletion changes the molecular interpretation and is a decisive, feasible step.",
      potentialEvidenceImpact:
        "Could confirm (or overturn) the biallelic/homozygous explanation for expert review.",
      drivers: [
        "Homozygous genotype reported but structural variation not yet excluded",
        `Recessive/biallelic hypothesis for ${c.gene}`,
        c.family.consanguinity ? "Consanguinity raises the prior for homozygosity by descent" : "Consanguinity not reported",
      ],
      suggestedIndividuals: c.family.parentsAvailable
        ? ["Parents — dosage/carrier testing helps distinguish true homozygosity from a hemizygous deletion"]
        : ["Parental dosage testing or CNV analysis in the proband"],
      lowValue: false,
    });
  }

  // ----- Compound-het pending / single het: find & phase the second allele.
  const complete = mc.secondAlleleIdentified && mc.phaseEstablished && mc.cnvStructuralAssessed;
  const drivers: string[] = [`Recessive/biallelic hypothesis for ${c.gene}`];
  if (!mc.secondAlleleIdentified) drivers.push("Only one variant identified so far (second allele not found)");
  if (!mc.phaseEstablished) drivers.push("Phase not established (in trans vs in cis unknown)");
  if (!mc.cnvStructuralAssessed) drivers.push("Copy-number / structural variation not yet assessed");
  if (c.variant.zygosity) drivers.push(`Reported zygosity: ${c.variant.zygosity}`);

  if (complete) {
    return finalize({
      id: "second-allele-phase",
      title: "Identify / phase second allele (CNV & structural)",
      gapKey: "molecular",
      direction: "either",
      evidenceBasis: MOLECULAR_BASIS,
      factors: { informationValue: 1.5, independence: 2, relevance: 3, feasibility: 4, effort: 2 },
      informationGained: "Whether the biallelic molecular explanation is complete.",
      whyItMatters:
        "The second allele has already been identified and phased and structural variation assessed, so the molecular explanation appears complete.",
      potentialEvidenceImpact: "Molecular completeness already established; limited additional yield.",
      drivers,
      lowValue: true,
      lowValueReason:
        "A second allele has been identified and phased and CNV/structural assessed; the biallelic explanation is already complete.",
    });
  }

  return finalize({
    id: "second-allele-phase",
    title: "Identify & phase the second allele (incl. CNV / structural)",
    gapKey: "molecular",
    direction: "either",
    evidenceBasis: MOLECULAR_BASIS,
    factors: { informationValue: 5, independence: 4.5, relevance: 5, feasibility: 4, effort: 2 },
    informationGained:
      "Whether a second (trans) pathogenic allele exists — via CNV/deletion analysis, deep-intronic/regulatory review, or a missed SNV — and confirming phase.",
    whyItMatters:
      "For a recessive hypothesis a single heterozygous variant is not a sufficient molecular explanation. Identifying and phasing the second allele (or excluding a structural variant) is the pivotal next step: it can complete the biallelic explanation, or, if no second hit is found in trans, materially weaken the hypothesis. This is typically more decisive than functional or in-silico work on the single known variant.",
    potentialEvidenceImpact:
      "Could establish (or refute) a complete biallelic explanation for expert review. Interpretation of any second allele and its phase requires expert appraisal.",
    drivers,
    suggestedIndividuals: c.family.parentsAvailable
      ? ["Parents — for phasing (trans vs cis) and carrier confirmation"]
      : ["Parental samples would enable phasing; long-read or trio sequencing otherwise"],
    clinicalCaveat: `${SECOND_ALLELE_VUS_CAVEAT} Parental testing for phasing also carries consent/counselling considerations.`,
    lowValue: false,
  });
}

function homozygosityMapping(c: VariantCase): RankedAction | null {
  const recessiveish =
    c.inheritanceModel === "autosomal-recessive" || c.inheritanceModel === "unknown";
  if (!recessiveish || c.family.consanguinity !== true) return null;

  const homozygous = zygosity(c) === "homozygous";
  return finalize({
    id: "homozygosity-mapping",
    title: "Homozygosity mapping / ROH analysis",
    gapKey: "molecular",
    direction: "either",
    evidenceBasis:
      "Autozygosity mapping in consanguineous pedigrees (runs of homozygosity) contextualises a homozygous candidate.",
    factors: { informationValue: homozygous ? 4 : 3.2, independence: 3.5, relevance: 4.5, feasibility: 5, effort: 2 },
    informationGained:
      "Whether the variant lies within a run of homozygosity consistent with identity by descent in a consanguineous pedigree.",
    whyItMatters:
      "In a consanguineous family, mapping runs of homozygosity (ROH) contextualises a homozygous candidate: a variant within a large ROH block is consistent with autozygosity and biallelic causation, whereas its absence from ROH can weaken a homozygous-by-descent hypothesis. It is low effort from existing genome/exome data.",
    potentialEvidenceImpact:
      "Could contribute autozygosity/inheritance context in either direction for expert review.",
    drivers: [
      "Consanguinity reported (raised prior for homozygosity by descent)",
      homozygous ? "Homozygous candidate variant" : "Recessive hypothesis with possible autozygosity",
    ],
    lowValue: false,
  });
}

function mosaicismAssessment(c: VariantCase): RankedAction | null {
  const dominantLike =
    c.inheritanceModel === "autosomal-dominant" ||
    c.inheritanceModel === "de-novo-dominant";
  const apparentDeNovo =
    c.inheritanceModel === "de-novo-dominant" ||
    c.evidence.deNovo.status === "present" ||
    (dominantLike && !c.family.historyPresent && c.family.parentsAvailable);
  if (!dominantLike || !apparentDeNovo) return null;

  return finalize({
    id: "mosaicism-assessment",
    title: "Mosaicism assessment (parental & somatic)",
    gapKey: "mosaicism",
    direction: "either",
    evidenceBasis:
      "Parental mosaicism affects recurrence risk; deep sequencing across tissues detects low-level mosaicism.",
    factors: { informationValue: 3.2, independence: 3.5, relevance: 3.5, feasibility: 3.5, effort: 3 },
    informationGained:
      "Whether the apparently de novo variant reflects parental mosaicism (recurrence-risk implications) or somatic mosaicism in the proband.",
    whyItMatters:
      "For an apparent de novo dominant variant, low-level parental mosaicism changes recurrence risk for future pregnancies, and somatic mosaicism in the proband can explain atypical or milder presentations. Deep sequencing across multiple tissues can detect it — a distinct evidence and counselling pathway.",
    potentialEvidenceImpact:
      "Could refine recurrence-risk and the de novo interpretation for expert review.",
    drivers: [
      "Apparently de novo dominant presentation",
      "Parental mosaicism affects recurrence risk; somatic mosaicism can alter the phenotype",
    ],
    clinicalCaveat:
      "Mosaicism findings have direct recurrence-risk and reproductive-counselling implications for the family.",
    lowValue: false,
  });
}

function literatureCaseReview(c: VariantCase): RankedAction {
  const cl = c.evidence.caseLevel.status;
  let informationValue = 3.5;
  if (cl === "absent") informationValue = 3.5;
  else if (cl === "partial") informationValue = 3;
  else if (cl === "present") informationValue = 2;
  else if (cl === "saturated") informationValue = 1.2;

  const independence = cl === "present" || cl === "saturated" ? 2 : 3.5;
  const drivers: string[] = [];
  if (cl === "absent") drivers.push("No independent case-level observations currently supplied");
  if (cl === "partial") drivers.push("Limited case-level evidence gathered so far");
  drivers.push(`Structured search possible for ${c.gene} ${c.variant.hgvs}`);
  drivers.push("Same-residue and same-domain variants can be reviewed for compatible phenotypes");

  const lowValue = cl === "saturated";
  return finalize({
    id: "literature-case-review",
    title: "Literature and case-level evidence review",
    gapKey: "caseLevel",
    direction: "either",
    evidenceBasis:
      "Independent case observations (ACMG/AMP PS4-type); appraise provenance and avoid double-counting database entries.",
    factors: { informationValue, independence, relevance: 4, feasibility: 5, effort: 2 },
    informationGained:
      "Whether independent individuals with the same or similar variants and compatible phenotypes have been reported.",
    whyItMatters:
      "Independent observations are a distinct evidence category from computational or population data. A structured search (ClinVar/HGMD/literature) for the same variant, the same residue, and the same functional domain is low effort and can surface genuinely new information — while watching for circularity (the same case counted twice, or database entries lacking assertion criteria).",
    potentialEvidenceImpact:
      "May contribute independent case-level context (supporting or refuting) for expert review. Interpretation of any reported cases requires expert appraisal of their quality, provenance, and relevance.",
    drivers,
    lowValue,
    lowValueReason: lowValue
      ? "Case-level evidence appears to have been thoroughly reviewed already; a further search is unlikely to add an independent evidence category."
      : undefined,
  });
}

function domainHotspot(c: VariantCase): RankedAction | null {
  const type = c.variant.type;
  if (!(type === "missense" || type === "in-frame-indel")) return null;

  const inDomain = c.variant.inCriticalDomain; // may be undefined (not looked up)
  const constrained =
    typeof c.geneConstraint?.misZ === "number" && c.geneConstraint.misZ >= 3.09;

  // When a live lookup has placed the residue, use it; otherwise stay generic.
  let informationValue = 3;
  let relevance = 3.5;
  if (inDomain === true) {
    informationValue = 3.5;
    relevance = 4;
  } else if (inDomain === false) {
    informationValue = 2.2;
    relevance = 2.5;
  }
  if (constrained) informationValue = Math.min(5, informationValue + 0.5);

  const drivers: string[] = [];
  if (inDomain === true)
    drivers.push(`Residue lies in the ${c.variant.criticalDomainName ?? "annotated functional"} domain (UniProt, live)`);
  else if (inDomain === false)
    drivers.push("Residue lies outside UniProt-annotated functional domains (live) — a domain/hotspot argument is weaker here");
  else drivers.push(`${type} change amenable to domain/structural mapping`);
  if (constrained)
    drivers.push(`Gene is strongly missense-constrained (gnomAD missense-z ${c.geneConstraint!.misZ!.toFixed(1)}), consistent with missense intolerance`);
  drivers.push("Distribution of known pathogenic vs benign variants in the same region can be reviewed");

  return finalize({
    id: "domain-hotspot",
    title: "Protein domain / mutational-hotspot assessment",
    gapKey: "domain",
    direction: "either",
    evidenceBasis:
      "Critical-domain / mutational-hotspot consideration (ACMG/AMP PM1); gene-level missense constraint (gnomAD) informs missense intolerance. Interpret alongside case-level data to avoid double-counting.",
    factors: { informationValue, independence: 2.5, relevance, feasibility: 5, effort: 2 },
    informationGained:
      "Whether the affected residue lies in a well-established critical functional domain or a mutational hotspot for the disorder.",
    whyItMatters:
      inDomain === false
        ? "The residue maps outside the gene's annotated functional domains, which weakens a domain/hotspot (PM1-type) argument — though missense constraint and case-level data still matter."
        : "Mapping the residue to a known critical domain or a hotspot of previously reported pathogenic variants (and checking for benign variation in the same region) is low effort and can add or subtract weight.",
    potentialEvidenceImpact:
      "Could contribute domain/hotspot context in either direction for expert review; overlaps with case-level evidence and should not be double-counted.",
    drivers,
    lowValue: false,
  });
}

function rnaSplicing(c: VariantCase): RankedAction {
  const rna = c.evidence.rnaSplicing.status;
  const type = c.variant.type;
  const proximity = c.variant.spliceProximity ?? "na";

  let relevance = 2;
  if (type === "splice-region" || proximity === "canonical" || proximity === "splice-region")
    relevance = 5;
  else if (proximity === "exonic-near-boundary") relevance = 3.5;
  else if (type === "synonymous") relevance = 3;
  else if (type === "in-frame-indel") relevance = 3;
  else if (type === "missense") relevance = 2;

  const predictedEffect =
    c.variant.predictedSpliceImpact === true ||
    type === "splice-region" ||
    proximity === "canonical" ||
    proximity === "splice-region";
  if (predictedEffect) relevance = Math.max(relevance, 4);

  let informationValue = 2;
  if (rna === "absent") informationValue = predictedEffect || relevance >= 4 ? 5 : 2.5;
  else if (rna === "partial") informationValue = 3;
  else if (rna === "present") informationValue = 1.5;

  const tissueAccessible = c.rnaTissueAccessible;
  const feasibility = tissueAccessible === false ? 2.5 : tissueAccessible === true ? 4.5 : 4;
  const independence = rna === "present" ? 2 : 4;
  const effort = tissueAccessible === false ? 4 : 3;

  const drivers: string[] = [];
  if (type === "splice-region") drivers.push("Variant lies in a splice region, where a transcript-level effect is plausible");
  if (proximity === "exonic-near-boundary") drivers.push("Variant is exonic but close to a junction (potential ESE/ESS disruption)");
  if (c.variant.predictedSpliceImpact) drivers.push("In-silico splice prediction flags a possible effect");
  if (predictedEffect && rna !== "present") drivers.push("A splicing consequence is predicted but not yet tested at the RNA level");
  if (rna === "absent") drivers.push("No RNA / transcript evidence currently available");
  if (tissueAccessible === false)
    drivers.push("Gene may not be expressed in accessible tissue (blood/fibroblast) — a minigene assay may be required");

  const lowValue = relevance <= 2 && !predictedEffect;
  return finalize({
    id: "rna-splicing",
    title: "RNA / splicing analysis",
    gapKey: "rnaSplicing",
    direction: "either",
    evidenceBasis:
      "RNA as functional evidence of a splicing consequence (ClinGen SVI splicing recommendations).",
    factors: { informationValue, independence, relevance, feasibility, effort },
    informationGained:
      "Whether the variant actually alters the transcript (e.g. exon skipping, intron retention, cryptic splice-site use).",
    whyItMatters: predictedEffect
      ? "A predicted splicing effect is a prediction until it is observed. RNA analysis can confirm or refute a transcript-level consequence, providing a fundamentally different category of evidence from in-silico splice predictors. Feasibility depends on the gene being expressed in an accessible tissue; otherwise a minigene assay may be needed."
      : "For a change without a strong predicted splicing consequence, RNA analysis is less likely to be informative and is lower relevance for this mechanism.",
    potentialEvidenceImpact:
      "An observed transcript effect (or a clear absence of one) could contribute functional/splicing evidence in either direction for expert review, depending on assay quality and interpretation.",
    drivers,
    clinicalCaveat:
      tissueAccessible === false
        ? "The gene may not be expressed in blood/fibroblast; a minigene or relevant-tissue approach may be required."
        : undefined,
    lowValue,
    lowValueReason: lowValue
      ? "There is no strong predicted splicing consequence for this variant type/position, so an RNA study is unlikely to change the evidence profile."
      : undefined,
  });
}

function functionalAssay(c: VariantCase): RankedAction {
  const fn = c.evidence.functional.status;
  let informationValue = 5;
  if (fn === "present" || fn === "contradictory") informationValue = 1.5;
  else if (fn === "partial") informationValue = 3;

  const independence = fn === "present" || fn === "contradictory" ? 2 : 5;
  const drivers: string[] = [];
  if (fn === "absent") drivers.push("No functional evidence currently available");
  if (fn === "partial") drivers.push("Only preliminary functional data available");
  drivers.push(`A mechanism-appropriate assay may be explorable for ${c.gene}-related disease`);

  const lowValue = fn === "present" || fn === "contradictory";
  return finalize({
    id: "functional-assay",
    title: "Functional characterisation (assay)",
    gapKey: "functional",
    direction: "either",
    evidenceBasis:
      "Functional-evidence calibration (ClinGen SVI; Brnich et al., 2019) — assays need validated benign/pathogenic controls.",
    sequencingNote:
      "High effort — sequence after prerequisites (orthogonal confirmation) and cheaper independent evidence have been exhausted.",
    factors: { informationValue, independence, relevance: 4, feasibility: 2, effort: 5 },
    informationGained:
      "Direct biological evidence of whether the variant affects protein/cellular function.",
    whyItMatters:
      "A well-designed functional assay can provide strong, independent biological evidence in either direction. In practice, clinically accredited assays are limited for many genes; most are research-grade and require validation with established benign/pathogenic controls before their results carry interpretive weight. This tempers the practical priority despite the high potential information value.",
    potentialEvidenceImpact:
      "A validated functional result could contribute functional evidence (supporting or refuting) for expert review. Assay design, validation, and interpretation all require domain expertise.",
    drivers,
    clinicalCaveat:
      "Functional assays for most genes are research-grade, not clinically accredited; results need a validated assay with controls before they carry interpretive weight.",
    lowValue,
    lowValueReason: lowValue
      ? "Functional evidence already exists for this variant; commissioning a new assay is unlikely to add an independent evidence category right now."
      : undefined,
  });
}

function deNovoAssessment(c: VariantCase): RankedAction {
  const dn = c.evidence.deNovo.status;
  const parents = c.family.parentsAvailable;
  const parentageConfirmed = c.family.parentageConfirmed === true;
  const model = c.inheritanceModel;
  const DENOVO_BASIS = "De novo evidence requires confirmed parentage (ACMG/AMP PS2/PM6).";

  if (model === "autosomal-recessive") {
    return finalize({
      id: "de-novo-assessment",
      title: "Parental testing for de novo status",
      gapKey: "deNovo",
      direction: "neutral",
      evidenceBasis: DENOVO_BASIS,
      factors: { informationValue: 1.5, independence: 2, relevance: 1.5, feasibility: parents ? 5 : 1, effort: 2 },
      informationGained: "Whether the single allele arose de novo.",
      whyItMatters:
        "For a recessive (biallelic) hypothesis, the de novo status of one heterozygous allele is not the informative question — establishing the second allele and phase is.",
      potentialEvidenceImpact: "Limited relevance under a recessive model.",
      drivers: ["Recessive hypothesis: de novo status of a single het allele is not decisive"],
      lowValue: true,
      lowValueReason:
        "Under a recessive/biallelic model, de novo assessment of a single heterozygous allele is not the informative next step.",
    });
  }

  if (model === "x-linked") {
    const informationValue = parents ? 3.8 : 2;
    return finalize({
      id: "de-novo-assessment",
      title: "Maternal carrier testing / de novo status (X-linked)",
      gapKey: "deNovo",
      direction: "either",
      evidenceBasis: DENOVO_BASIS,
      factors: { informationValue, independence: 4, relevance: 4, feasibility: parents ? 5 : 1.5, effort: 2 },
      informationGained:
        "Whether an affected male inherited the variant from a carrier mother or it arose de novo.",
      whyItMatters:
        "For an X-linked hypothesis, testing the mother's carrier status distinguishes maternal inheritance from a de novo event, with direct recurrence-risk implications for the family and interpretive weight for the variant.",
      potentialEvidenceImpact:
        "Could contribute inheritance/de novo context for expert review; recurrence risk depends on maternal carrier status.",
      drivers: [
        "X-linked hypothesis: maternal carrier status is the key discriminator",
        parents ? "Mother available for carrier testing" : "Maternal sample needed",
        !parentageConfirmed ? "Confirmed parentage required for a de novo claim" : "Parentage confirmed",
      ],
      clinicalCaveat:
        "Maternal carrier status carries recurrence-risk and cascade-counselling implications.",
      lowValue: !parents,
      lowValueReason: !parents ? "Maternal sample not available to establish carrier vs de novo." : undefined,
    });
  }

  const sporadic = model === "de-novo-dominant" || !c.family.historyPresent;
  let informationValue = 2;
  if (dn === "absent" && parents) informationValue = sporadic ? 3.5 : 2.5;
  else if (dn === "partial") informationValue = 3;
  else if (dn === "present") informationValue = 1.5;

  const relevance = sporadic ? 3 : 2.5;
  const feasibility = parents ? 5 : 1;

  const drivers: string[] = [];
  if (parents) drivers.push("Parental samples appear to be available");
  else drivers.push("Parental samples do not appear to be available");
  if (!parentageConfirmed) drivers.push("Biological parentage not yet confirmed (prerequisite for a de novo claim)");
  if (sporadic && !c.family.historyPresent)
    drivers.push("Absent family history is weak evidence (penetrance, family size, non-paternity, or mild expression can mask inheritance)");
  else if (sporadic) drivers.push("Presentation treated as sporadic under a de-novo-dominant hypothesis");
  else drivers.push("Family history suggests the variant is likely inherited, reducing de novo relevance");
  if (dn === "absent") drivers.push("De novo status not yet assessed");

  const lowValue = !parents || (!sporadic && dn !== "absent") || (!sporadic && informationValue < 2.6);
  return finalize({
    id: "de-novo-assessment",
    title: "Parental testing for de novo status",
    gapKey: "deNovo",
    direction: "either",
    evidenceBasis: DENOVO_BASIS,
    factors: { informationValue, independence: 4, relevance, feasibility, effort: 2 },
    informationGained: "Whether the variant arose de novo or was inherited from a parent.",
    whyItMatters: sporadic
      ? "For an apparently sporadic presentation, a confirmed de novo origin is a distinct and potentially informative line of evidence — but it requires confirmed biological parentage, and a negative family history alone is weak (penetrance, family size, and non-paternity can all mask inheritance)."
      : "Because the family history points to an inherited variant, de novo assessment is lower relevance here — the variant is likely inherited from an affected lineage.",
    potentialEvidenceImpact:
      "Confirmed parentage plus de novo occurrence could contribute to inheritance-related evidence for expert review; an inherited result is also informative in the family context.",
    drivers,
    clinicalCaveat: !parentageConfirmed
      ? "A de novo claim is only valid with confirmed biological parentage; test the trio accordingly."
      : undefined,
    lowValue,
    lowValueReason: lowValue
      ? !parents
        ? "Parents do not appear available, so de novo status cannot currently be established."
        : "The family history already indicates an inherited variant, so de novo testing is unlikely to be the most informative next step."
      : undefined,
  });
}

function deeperPhenotyping(c: VariantCase): RankedAction {
  const ph = c.evidence.phenotype.status;
  let informationValue = 2.5;
  if (ph === "partial") informationValue = 3.5;
  else if (ph === "present") informationValue = 2;
  else if (ph === "absent") informationValue = 3;

  const drivers: string[] = [];
  if (ph === "partial") drivers.push("Phenotype fit is only partially characterised");
  if (ph === "present") drivers.push("Phenotype already appears compatible with the gene-associated disease");
  drivers.push("Targeted re-phenotyping (imaging, specialist review, HPO refinement) may sharpen the disease hypothesis");

  const lowValue = ph === "present";
  return finalize({
    id: "deeper-phenotyping",
    title: "Deeper / targeted phenotyping",
    gapKey: "phenotype",
    direction: "either",
    evidenceBasis:
      "Phenotype specificity affects the prior (ACMG/AMP PP4); semantic HPO-gene similarity tools can quantify fit.",
    factors: { informationValue, independence: 2.5, relevance: 3, feasibility: 4, effort: 2 },
    informationGained:
      "Whether refined phenotyping strengthens or weakens the match to the candidate gene/disease.",
    whyItMatters:
      "Refining the phenotype can change the prior probability that the gene explains the presentation. It refines an existing evidence category rather than opening a wholly new one.",
    potentialEvidenceImpact:
      "Could contribute phenotype-related context (in either direction) for expert review; it refines rather than replaces existing phenotype evidence.",
    drivers,
    lowValue,
    lowValueReason: lowValue
      ? "The phenotype already appears compatible with the gene-associated disease, so further phenotyping is likely to be confirmatory."
      : undefined,
  });
}

function differentialReanalysis(c: VariantCase): RankedAction {
  const validity = c.geneDiseaseValidity ?? "unknown";
  const ph = c.evidence.phenotype.status;
  const geneUncertain = validity === "limited" || validity === "moderate" || validity === "unknown";
  const phenotypeIncomplete = ph === "partial" || ph === "absent";
  const worthwhile = geneUncertain || phenotypeIncomplete;

  const drivers: string[] = [`Gene-disease validity for ${c.gene}: ${validity}`];
  if (geneUncertain) drivers.push("Gene-disease relationship is not firmly established");
  if (phenotypeIncomplete) drivers.push("The candidate variant may not fully explain the phenotype");
  drivers.push("Exome/genome reanalysis can surface alternative candidate genes");

  return finalize({
    id: "differential-reanalysis",
    title: "Broaden the differential / genome reanalysis",
    gapKey: "differential",
    direction: "either",
    evidenceBasis:
      "Periodic exome/genome reanalysis improves diagnostic yield and can identify a better candidate gene.",
    factors: {
      informationValue: worthwhile ? 3 : 1.8,
      independence: 3.5,
      relevance: worthwhile ? 3.5 : 2,
      feasibility: 4,
      effort: 2,
    },
    informationGained: "Whether a different gene/variant is a better explanation for the phenotype.",
    whyItMatters:
      "When the gene-disease link is uncertain or the variant does not fully explain the phenotype, reanalysing the exome/genome for alternative candidates can change the working hypothesis entirely — a different question from strengthening the current variant.",
    potentialEvidenceImpact:
      "Could redirect the hypothesis to a different gene for expert review, or reinforce the current candidate if none is found.",
    drivers,
    lowValue: !worthwhile,
    lowValueReason: !worthwhile
      ? "The gene-disease relationship is well established and the phenotype fits; a broad reanalysis is lower yield right now (periodic reanalysis still advised)."
      : undefined,
  });
}

function populationReassessment(c: VariantCase): RankedAction {
  const pop = c.evidence.population.status;
  const assessed = pop === "present" || pop === "saturated";
  const common = c.diseasePrevalence === "common" || c.diseasePrevalence === "moderate";

  let informationValue: number;
  if (!assessed) informationValue = 3.5;
  else if (common) informationValue = 3.2;
  else informationValue = 2;

  const drivers: string[] = [];
  if (assessed) drivers.push("Population frequency already assessed (variant reported rare/absent)");
  else drivers.push("Population frequency not yet robustly assessed");
  if (common)
    drivers.push("Disorder is relatively common — gene/disease-specific BS1/BA1-style thresholds and sub-populations are worth checking");
  drivers.push("Frequency evidence can support a benign-direction reassessment");

  const lowValue = assessed && !common;
  return finalize({
    id: "population-reassessment",
    title: "Population frequency re-assessment (gene/disease-specific)",
    gapKey: "population",
    direction: "either",
    evidenceBasis:
      "Disease-specific BA1/BS1 frequency thresholds (gnomAD; ClinGen VCEP specifications).",
    factors: { informationValue, independence: 2.5, relevance: common ? 4 : 3.5, feasibility: 5, effort: 2 },
    informationGained:
      "Whether the variant is more frequent than expected for the disorder (benign-direction) or robustly rare (supporting).",
    whyItMatters:
      "Population evidence is explicitly bidirectional. Checking gnomAD sub-populations against gene/disease-specific frequency thresholds can support a benign-direction reassessment if the variant is too common for the disorder's prevalence, or reinforce rarity. For a relatively common disorder this threshold check is worthwhile even when the variant is rare overall.",
    potentialEvidenceImpact:
      "Could contribute population-frequency context in either direction for expert review, judged against disease-appropriate thresholds.",
    drivers,
    lowValue,
    lowValueReason: lowValue
      ? "Population frequency has already been assessed and the disorder is rare, so a re-check is largely confirmatory."
      : undefined,
  });
}

function orthogonalConfirmation(c: VariantCase): RankedAction | null {
  if (c.variant.orthogonallyConfirmed === true) return null;

  return finalize({
    id: "orthogonal-confirmation",
    title: "Orthogonal confirmation of the variant call",
    gapKey: "technical",
    direction: "neutral",
    prerequisite: true,
    sequencingNote:
      "Prerequisite — complete before committing to high-effort investigations (functional, RNA, extended family studies).",
    evidenceBasis:
      "Analytical validity / orthogonal confirmation of NGS calls (e.g. Sanger or documented read support) is standard laboratory practice.",
    factors: { informationValue: 2.5, independence: 2, relevance: 4, feasibility: 5, effort: 2 },
    informationGained: "Whether the variant is a true positive rather than a sequencing artefact.",
    whyItMatters:
      "Before investing in downstream evidence (functional, RNA, family studies), confirm the call is real via an orthogonal method or adequate read support. An unconfirmed artefact would make all subsequent evidence-gathering moot. Low information about pathogenicity itself, but a cheap prerequisite.",
    potentialEvidenceImpact:
      "Establishes technical validity of the finding; a prerequisite rather than pathogenicity evidence.",
    drivers: [
      "Variant not yet orthogonally confirmed",
      "Calls from panels/exome/genome benefit from orthogonal confirmation or documented read support",
    ],
    lowValue: false,
  });
}

function geneDiseaseValidityReanalysis(c: VariantCase): RankedAction {
  const validity = c.geneDiseaseValidity ?? "unknown";
  const wellEstablished = validity === "definitive" || validity === "strong";

  const drivers: string[] = [`Gene-disease validity for ${c.gene}: ${validity}`];
  if (!wellEstablished)
    drivers.push("A limited/moderate/unknown gene-disease relationship materially affects the prior that this gene explains the phenotype");
  drivers.push("Periodic reanalysis against updated ClinGen curation / literature is standard practice");

  const lowValue = wellEstablished;
  return finalize({
    id: "gene-disease-validity",
    title: "Gene-disease validity review & reanalysis",
    gapKey: "geneValidity",
    direction: "either",
    evidenceBasis:
      "ClinGen gene-disease clinical validity framework (Strande et al., 2017).",
    factors: {
      informationValue: wellEstablished ? 1.8 : 3.2,
      independence: 3,
      relevance: 3.5,
      feasibility: 5,
      effort: 2,
    },
    informationGained:
      "Whether the gene-disease relationship is robust enough to anchor interpretation, and whether reanalysis is due.",
    whyItMatters: wellEstablished
      ? "The gene-disease relationship is well established, so reanalysis is low immediate yield — though periodic reanalysis remains good practice."
      : "If the gene-disease relationship is only moderate, limited, or unknown, that materially changes the prior that this gene explains the phenotype. Reviewing ClinGen gene-disease validity and reanalysing against updated curation can strengthen or weaken the whole hypothesis, not just this variant.",
    potentialEvidenceImpact:
      "Could reframe the working hypothesis in either direction for expert review; affects the prior rather than variant-level evidence directly.",
    drivers,
    lowValue,
    lowValueReason: lowValue
      ? "Gene-disease validity is well established; reanalysis is low immediate yield (though periodic reanalysis remains good practice)."
      : undefined,
  });
}

function additionalComputational(c: VariantCase): RankedAction {
  const comp = c.evidence.computational.status;
  const saturated = comp === "present" || comp === "saturated";

  const drivers: string[] = [];
  if (saturated) drivers.push("Computational predictions have already been considered for this variant");
  else drivers.push("No computational predictions on file yet");

  const lowValue = saturated;
  return finalize({
    id: "additional-computational",
    title: "Run additional computational pathogenicity predictors",
    gapKey: "computational",
    direction: "either",
    evidenceBasis:
      "In-silico predictors are correlated; combined use is capped (ACMG/AMP PP3/BP4; Pejaver et al., 2022).",
    factors: {
      informationValue: saturated ? 1.2 : 3,
      independence: saturated ? 1 : 3,
      relevance: 3,
      feasibility: 5,
      effort: 1,
    },
    informationGained: "Additional in-silico predictions of variant effect.",
    whyItMatters: saturated
      ? "Multiple computational predictions have already been considered. Additional predictors tend to be correlated with existing ones and rarely provide an independent evidence category."
      : "If no in-silico evidence exists yet, a first computational assessment is a cheap, quick starting point — though it remains a single evidence category.",
    potentialEvidenceImpact: saturated
      ? "Unlikely to materially change the evidence profile because computational evidence has already been considered."
      : "Could provide an initial computational evidence category for expert review.",
    drivers,
    lowValue,
    lowValueReason: lowValue
      ? "Computational evidence is already available. Further correlated predictors are unlikely to provide a sufficiently independent evidence category."
      : undefined,
  });
}

/**
 * All generators. Order here does not matter; the planner ranks by score.
 * Generators may return null when an action is not applicable to the case.
 */
export const ACTION_GENERATORS: Array<(c: VariantCase) => RankedAction | null> = [
  familySegregation,
  establishInheritanceModel,
  secondAllelePhase,
  homozygosityMapping,
  mosaicismAssessment,
  literatureCaseReview,
  domainHotspot,
  rnaSplicing,
  functionalAssay,
  deNovoAssessment,
  deeperPhenotyping,
  differentialReanalysis,
  populationReassessment,
  orthogonalConfirmation,
  geneDiseaseValidityReanalysis,
  additionalComputational,
];
