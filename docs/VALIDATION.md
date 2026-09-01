# Validation & Calibration Plan

> **Status: plan, not results.** This document describes how the Variant
> Resolution Planner's prioritisation *would* be calibrated and validated. The
> prototype ships with **uncalibrated, expert-informed weights** and has **not**
> been validated. Nothing here should be read as evidence of clinical
> performance. It exists so that calibration is scoped honestly rather than
> faked with more uncited numbers.

## 1. What we are (and are not) claiming

- **Claim:** the tool proposes a transparent, inspectable ordering of evidence-
  gathering actions by expected information gain per unit effort, and flags
  low-value actions.
- **Not claimed:** that this ordering is optimal, calibrated, or clinically
  validated; that it improves diagnostic yield, turnaround, or cost; or that it
  should influence patient care. Establishing any of those requires the work
  below.

## 2. Success criteria (what "good" means)

1. **Concordance with what actually resolved the VUS.** For historically
   resolved VUS, did the action the planner ranked #1 correspond to the evidence
   category that, in reality, moved the classification?
2. **Calibration.** Do higher prototype scores correspond to higher realised
   information gain / diagnostic yield? (Reliability diagram; the score should
   be monotonic with outcome even if not perfectly scaled.)
3. **Low-value precision.** Of actions flagged "Not recommended", how often did
   they in fact add no independent evidence?
4. **Resolvability honesty.** Of cases flagged "may remain a VUS", how many did
   remain unresolved over a defined follow-up window (avoiding false optimism)?
5. **Safety.** Zero instances of the LLM layer emitting a classification or
   treatment recommendation that reaches the user (guardrail effectiveness).

## 3. Ground-truth data sources

No real patient data is used in the prototype. A validation study would draw on:

- **ClinVar reclassification histories** — VUS that later moved to (likely)
  benign / (likely) pathogenic with ≥2-star review status and dated submission
  history, to reconstruct *which evidence category* drove the change.
- **ClinGen VCEP-curated variants** — expert-panel decisions with explicit
  ACMG/AMP criteria applied, giving a per-criterion "what evidence counted"
  label.
- **Published functional/segregation/RNA calibration datasets** — e.g. ClinGen
  SVI functional-assay calibration sets, splicing/RNA outcome datasets.
- **Institutional resolved-VUS cohorts** — retrospective lab records (under
  appropriate governance/IRB) linking the investigation performed to the
  resolution, including cost and turnaround.

All use requires appropriate data governance, de-identification, and (for
institutional data) ethics/IRB approval.

## 4. Study designs

### 4.1 Retrospective concordance (fastest, lowest risk)
Reconstruct the pre-resolution evidence state for each resolved VUS, run the
planner, and compare its ranking to the evidence category that actually resolved
the variant. Primary metric: top-1 / top-3 concordance. Stratify by inheritance
model, variant type, and gene-disease validity.

### 4.2 Calibration of the score
Regress realised outcome (resolved vs not; magnitude of evidence added) on the
prototype factors. Replace hand-set weights with fitted coefficients, or map the
factors onto **likelihood ratios** using the Bayesian ACMG formulation
(Tavtigian et al. 2018) and ClinGen SVI strength calibrations (segregation:
Jarvik & Browning 2016; functional: Brnich et al. 2019; computational: Pejaver
et al. 2022). Report a reliability diagram and Brier score.

### 4.3 Prospective "shadow mode"
Run the planner alongside routine interpretation without influencing decisions.
Record what the MDT/scientist did next and the outcome. Compare planner ranking
to real next steps and to yield. Only after shadow-mode performance is
acceptable would any decision-support use be considered.

## 5. Calibration approach for the factors

Each scoring factor should be grounded rather than intuited:

| Factor | Grounding source |
| --- | --- |
| Information value | Realised diagnostic yield / evidence strength per investigation type (trio, CNV, RNA, functional, segregation) from literature + cohort |
| Independence | ACMG/AMP evidence-category structure; correlation between predictors (PP3/BP4 capping) |
| Relevance | Mechanism/gene-specific applicability (VCEP specifications) |
| Feasibility | Sample/tissue/assay availability; local lab turnaround |
| Effort | Real cost and turnaround from lab operations data |

Deliverable: replace the multiplicative heuristic with either fitted weights or
an explicit likelihood-ratio combination, with the source of every number cited.

## 6. LLM-layer governance (the Bedrock narrative)

- The narrative is **presentation only**; all structured output is
  deterministic. The regex guardrail (`validateNarrative`) is **best-effort**,
  not a guarantee.
- Validation: adversarial prompt/response testing for classification and
  treatment leakage; measure guardrail precision/recall on a labelled set of
  safe vs unsafe narratives; track false-positive fallbacks (legitimate
  narratives wrongly rejected).
- Operational: log rejected narratives for review; version the guardrail;
  consider a second model-based check for production. Encrypt/limit logs if any
  real data is ever introduced (Bedrock request/response can be logged).

## 7. Out of scope for this prototype (named honestly)

- Real HPO/OMIM phenotype-similarity (the shipped engine uses a synthetic map).
- Mitochondrial / imprinting / repeat-expansion mechanisms.
- Multi-candidate triage across a full variant list.
- Any clinical deployment, EHR integration, or laboratory ordering.

## 8. References (frameworks named in the tool)

- Richards S, et al. *ACMG/AMP standards and guidelines for variant
  interpretation.* Genet Med. 2015.
- Tavtigian SV, et al. *Modeling the ACMG/AMP variant classification guidelines
  as a Bayesian classification framework.* Genet Med. 2018.
- Brnich SE, et al. *Recommendations for application of the functional evidence
  PS3/BS3 criterion.* Genome Med. 2019.
- Jarvik GP, Browning BL. *Consideration of cosegregation in variant
  interpretation.* Am J Hum Genet. 2016.
- Pejaver V, et al. *Calibration of computational tools for missense variant
  pathogenicity (ClinGen SVI).* Am J Hum Genet. 2022.
- Strande NT, et al. *Evaluating the clinical validity of gene-disease
  associations (ClinGen).* Am J Hum Genet. 2017.

*Reference details are provided for scoping; verify citations before formal use.*
