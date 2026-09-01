# Variant Resolution Planner

**From uncertain variant to evidence plan.**

A research and demonstration prototype that answers a different question from most
genomic tools. Instead of _"How should this variant be classified?"_ it asks:

> **"What additional evidence would be most useful to resolve the uncertainty around this variant?"**

Given a variant of uncertain significance (VUS), the patient phenotype, disease
context, family information, and the currently available evidence, it produces a
prioritized **Variant Resolution Plan**: what evidence to gather next, why it
matters, and how it could inform expert reassessment.

> ⚠️ This is a research/demonstration prototype. The clinical scenarios are
> **synthetic**. An optional **live-lookup mode** retrieves **real** public data
> (gnomAD, ClinVar, dbNSFP, HPO) for cases that carry real variant identifiers.
> It is **not** a clinical diagnostic system, does **not** classify variants
> (ClinVar assertions are shown as external context only), and does **not**
> provide medical advice.

## Live knowledgebase integration

Cases with real identifiers (gene / rsID / genomic HGVS) support **Fetch live
annotations**, which calls the backend `/annotate` endpoint to retrieve, with
provenance and timestamps:

- **gnomAD v4 allele frequency** queried directly from the gnomAD GraphQL API
  (with AC/AN and version label; falls back to the older MyVariant.info value if
  the direct query fails).
- **dbNSFP** predictors (REVEL, CADD, SIFT, PolyPhen, **AlphaMissense**) via
  [MyVariant.info](https://myvariant.info) (BioThings).
- **gnomAD gene constraint** (pLI, LOEUF, missense-z) via the gnomAD GraphQL API
  — gene-level mechanism context (LoF-intolerance, missense constraint).
- **ClinVar** classification, **review status / star rating**, and associated
  condition count from the current NCBI record (E-utilities), shown as external
  case-level context (not adopted as the tool's own call).
- **Ensembl VEP** — real molecular consequence and protein position, used to
  derive the variant type and splice-region proximity.
- **UniProt** protein domains — whether the residue lies in a critical domain
  (PM1-type context).
- **GTEx v8** tissue expression — derives RNA-study feasibility (e.g. a cardiac
  gene not expressed in blood needs a minigene assay).
- **LitVar2** (NCBI) — variant-level publication count.
- Real **gene→phenotype** associations from the **Human Phenotype Ontology**
  ([ontology.jax.org](https://ontology.jax.org)), used for phenotype matching.

The bundled demo includes a **real MYH7 VUS** (`rs727504355` / ClinVar 177846,
p.Ala1763Thr) so the live pipeline returns real data out of the box. ClinVar
significances are surfaced as **external assertions** for case-level context;
the tool still does not assign its own classification.

**Attribution.** Data © their respective sources: gnomAD (Broad Institute),
ClinVar / LitVar2 / E-utilities (NCBI), dbNSFP, AlphaMissense (Google DeepMind,
via dbNSFP), MyVariant.info (BioThings), Ensembl (EMBL-EBI), UniProt, GTEx, and
the Human Phenotype Ontology (Jackson Laboratory). Live lookups are best-effort
against public APIs and subject to those services' availability and terms.
ClinGen gene-disease validity was evaluated but has no suitable live JSON API
(its data is distributed as batch downloads), so it remains a manual input.

---

## What problem this solves

Variant interpretation often ends in uncertainty. A VUS is not just a label — it
represents a set of **unanswered evidence questions**. The usual next move is to
"run more predictors," but additional correlated computational evidence rarely
changes the picture.

This prototype treats a VUS as an evidence-gap problem and asks where the next
unit of investigative effort is most likely to add **independent** information.

## What it does

- Summarises the **current evidence** across eight categories (population,
  phenotype, segregation, de novo, functional, RNA/splicing, case-level,
  computational).
- Identifies the **important evidence gaps** and which are potentially resolvable.
- Generates candidate next actions and **ranks them** with a transparent,
  inspectable prioritization score.
- Surfaces the single **highest-value next action** prominently.
- Explicitly flags **low-value next actions** — where more effort is unlikely to
  add independent information (this is the key differentiator).
- Provides full **traceability**: every recommendation lists the specific case
  facts that drove it.
- **Updates the plan as new evidence arrives** (the "Add new evidence" demo).

## What it does NOT do

- Does **not** diagnose or provide medical advice.
- Does **not** independently classify variants or change a classification.
- Does **not** assign or reference specific ACMG/AMP criteria codes.
- Does **not** implement the ACMG/AMP framework as a production clinical system.
- Does **not** replace geneticists or laboratory professionals.

All variant interpretation, evidence application, and clinical decisions require
review by appropriately qualified professionals.

---

## Architecture

The reasoning is **deterministic and runs entirely in the browser**, so the demo
works with zero setup. Amazon Bedrock is an **optional** enhancement that only
rewrites the narrative summary into fluent prose — it never produces the
structured scores, ranking, or recommendations.

```
┌──────────────────────────────────────────────────────────┐
│  Browser (React + TypeScript SPA)                          │
│                                                            │
│   Structured VariantCase (JSON)                            │
│            │                                               │
│            ▼                                               │
│   Deterministic reasoning engine                           │
│     • evidence-gap analysis                                │
│     • candidate action generation                          │
│     • transparent scoring + ranking                        │
│     • low-value detection                                  │
│            │                                               │
│            ├─────────────► Resolution Plan (rendered)      │
│            │                                               │
│            ▼ (optional)                                    │
│   POST /explain  { case, plan }   (same-origin)            │
└───────────────────────────┬────────────────────────────────┘
                            │  (only when a backend is reachable)
                            ▼
        ┌───────────────────────────────────────────┐
        │  CloudFront  (single public entry point)    │
        │    default (*)  ── OAC ──►  S3 (SPA)         │
        │    /explain,/health ─────►  API Gateway      │
        └───────────────────────────┬─────────────────┘
                                    ▼
                        ┌───────────────────────────┐
                        │  AWS Lambda (private)      │
                        │  Converse API, maxTokens   │
                        │            ▼               │
                        │      Amazon Bedrock        │
                        │   (Claude, narrative only) │
                        └───────────────────────────┘

Hosting (AWS): S3 (private) + CloudFront (OAC) serves the SPA. The API
(POST /explain) is served same-origin: CloudFront routes it to an API Gateway
HTTP API backed by a Lambda that is NOT publicly exposed. A runtime config.json
tells the SPA the API origin (the CloudFront domain itself).
```

**Separation of concerns is deliberate:** structured data is computed
deterministically; the LLM only phrases the summary. The goal is not to ask AI to
make the final call — it is to use AI to help decide what evidence would make the
next _human_ decision better.

### Repository layout

```
web/       React + Vite + TypeScript SPA (contains the reasoning engine)
server/    Optional Amazon Bedrock backend (Lambda handler + local Express server)
infra/     AWS CDK app (S3 + CloudFront + Lambda Function URL)
```

---

## Running locally

Requires Node.js 18+.

### 1. The app (no AWS, no credentials)

```bash
cd web
npm install
npm run dev
```

Open the printed URL (default http://localhost:5173).

**60-second demo:**
1. A synthetic MYH7 hypertrophic cardiomyopathy case is preloaded.
2. Click **Generate Resolution Plan**.
3. See the top recommended action (targeted family segregation testing), the
   ranked plan, the evidence value matrix, and the **Low-value next actions**
   (additional computational predictors).
4. Click **Add new evidence → "Affected mother carries the variant"** and watch
   segregation drop in priority as literature/case review rises.
5. Switch to the second demo case (splice-region variant) to see the plan lead
   with **RNA analysis** instead — the recommendation follows the mechanism.

### 2. Optional: enhanced narrative via Amazon Bedrock (local backend)

Requires AWS credentials in your environment and Bedrock model access enabled in
your region.

```bash
cd server
npm install
npm run dev        # starts http://localhost:8787
```

Then point the frontend at it:

```bash
cd web
cp .env.example .env
# set VITE_API_URL=http://localhost:8787 in .env
npm run dev
```

Generate a plan; the narrative paragraph is now produced by Bedrock, and the
header shows **Bedrock: active**. If the backend or model is unavailable, the app
silently falls back to the local narrative.

Configuration (environment variables for the backend):

| Variable            | Default                                          | Purpose                                  |
| ------------------- | ------------------------------------------------ | ---------------------------------------- |
| `BEDROCK_MODEL_ID`  | `us.anthropic.claude-3-5-sonnet-20241022-v2:0`   | Model / cross-region inference profile   |
| `BEDROCK_REGION`    | `us-east-1`                                       | Bedrock region                           |
| `BEDROCK_MAX_TOKENS`| `600`                                             | Max output tokens (set explicitly)       |
| `ALLOWED_ORIGIN`    | `*`                                               | CORS origin (Lambda only)                |

> Verify your model ID is available: `aws bedrock list-inference-profiles --region <region>`

---

## Running on AWS

Deploys the SPA to S3 + CloudFront and the Bedrock narrative API as a Lambda
Function URL, using AWS CDK. Requires the AWS CLI configured, Docker **not**
required (bundling uses local esbuild), and Bedrock model access enabled.

```bash
# 1. Build the frontend (CDK deploys web/dist)
npm --prefix web install
npm --prefix web run build

# 2. Install and deploy the infrastructure
cd infra
npm install
npx cdk bootstrap            # first time only, per account/region
npx cdk deploy
```

Outputs:
- **SiteUrl** — the CloudFront URL of the app. Open it and click _Generate
  Resolution Plan_. The narrative is enhanced by Bedrock automatically (the
  deploy writes a runtime `config.json` pointing the SPA at the API, same-origin).
- **ApiEndpoint** — the Bedrock explanation endpoint (`<SiteUrl>/explain`),
  served via CloudFront → API Gateway → Lambda.

Useful overrides:

```bash
npx cdk deploy -c bedrockModelId=us.anthropic.claude-3-5-haiku-20241022-v1:0
npx cdk deploy -c allowedOrigin=https://your-cloudfront-domain
```

Tear down:

```bash
cd infra && npx cdk destroy
```

### Security notes (prototype)

This deployment is optimised for a **synthetic-data demo**, not production:

- The **Lambda is not publicly exposed** — it is reachable only through API
  Gateway (scoped `apigateway.amazonaws.com` permission), fronted by CloudFront.
  The API Gateway HTTP API itself is unauthenticated (fine for a synthetic-data
  demo). For production, add an authorizer/WAF and request throttling, and set
  `-c allowedOrigin=<your CloudFront domain>` to tighten CORS.
- IAM grants `bedrock:InvokeModel` scoped to Anthropic Claude models and
  inference profiles — tighten to a single model ARN in production.
- The S3 site bucket is private (CloudFront Origin Access Control) with SSL
  enforced; it is set to auto-delete on `cdk destroy` for demo convenience.
- No PII is used or logged. If you adapt this for real data, note that Bedrock
  request/response content can be logged — encrypt logs with KMS and restrict
  access.

---

## How the prioritization works

Each candidate action is scored with a transparent, **prototype** formula:

```
Resolution Priority Score =
    (Information value × Independence × Relevance × Feasibility) / Effort
```

- **Information value** — could the evidence materially strengthen or weaken the hypothesis?
- **Independence** — does it produce a genuinely new _category_ of evidence?
- **Relevance** — is it biologically appropriate for this variant and mechanism?
- **Feasibility** — can the evidence realistically be obtained for this case?
- **Effort** — how difficult/expensive is it (used as the divisor)?

Each factor is computed deterministically from the structured case (for example,
segregation scores high only when there is a family history _and_ available
relatives _and_ no existing segregation data). The exact mathematics is **not
scientifically validated** — it is a prioritization aid, and every score can be
expanded in the UI to see the factor breakdown.

**Two separate axes.** _Priority_ (the score) measures expected information gain
**per unit effort**. _Potential impact_ measures how decisively a result could
move interpretation **if obtained** (independent of effort), derived from the
same factors so the two cannot arbitrarily contradict. A decisive test (e.g. a
functional assay) can still be low priority because it is costly — the UI shows
both and explains the difference.

**Grounding (not calibration).** Factor weights are _informed by_ but **not
formally calibrated to** published frameworks — ACMG/AMP (Richards et al. 2015),
the Bayesian ACMG points model (Tavtigian et al. 2018), ClinGen SVI functional
and segregation calibrations, and gnomAD-based disease-specific frequency
thresholds. Each action shows a short "evidence basis" citation. Formal
calibration against diagnostic-yield / likelihood-ratio data is deliberately
left as future work rather than encoded as more uncited numbers.

**Sequencing and resolvability.** The plan flags prerequisite steps (e.g.
orthogonal confirmation before high-effort assays) and gives an honest
"resolvability" read — whether the VUS looks resolvable now, is constrained by
missing samples/assays, or may realistically remain a VUS.

**Phenotype fit.** The patient's HPO terms are scored against the candidate
gene's expected phenotype to derive the phenotype-fit status and surface
"expected but not observed" features worth checking. Note: the shipped
gene-phenotype map is **synthetic and illustrative** (demo genes only); a
production system would compute semantic similarity against real HPO/OMIM
annotations using the ontology graph.

**Validation.** The prototype's weights are **not calibrated** and the tool is
**not validated**. See [docs/VALIDATION.md](docs/VALIDATION.md) for how
calibration and validation would be done (ground-truth sources, study designs,
likelihood-ratio calibration, and LLM-guardrail governance).

**Low-value detection** is domain-driven: an action is flagged when it is unlikely
to add an independent evidence category (e.g. more computational predictors when
computational evidence is already considered), when the evidence already exists,
or when it is not feasible. This is what turns the tool from "AI generates a list
of tests" into a planner that reasons about where the next unit of effort is best
spent.

---

## Verification

```bash
npm --prefix web run build        # typecheck + production build
npm --prefix server run build     # typecheck + compile the Lambda/backend
npm --prefix infra run typecheck  # typecheck the CDK app
cd infra && npx cdk synth         # validate the CloudFormation synthesis
```
