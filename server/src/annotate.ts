// ---------------------------------------------------------------------------
// Live annotation from real scientific knowledgebases (all public, no API key).
//
//   MyVariant.info (BioThings)  -> gnomAD AF, ClinVar assertions+id, dbNSFP
//                                  predictors (REVEL, CADD, SIFT, PolyPhen,
//                                  AlphaMissense).
//   gnomAD GraphQL              -> gene constraint (pLI, LOEUF, missense-z).
//   NCBI eutils (ClinVar)       -> review status / star rating, last evaluated.
//   Ensembl VEP REST            -> molecular consequence, protein position,
//                                  splice-region proximity.
//   UniProt REST                -> protein domains (critical-domain / hotspot).
//   GTEx v8                     -> tissue expression (RNA-study feasibility).
//   LitVar2 (NCBI)              -> variant-level publication count.
//   HPO (ontology.jax.org)      -> gene -> phenotype associations.
//
// Retrieval + provenance only. ClinVar significances are surfaced as EXTERNAL
// assertions; the planner does not itself classify.
//
// Attribution: gnomAD (Broad), ClinVar/LitVar/E-utilities (NCBI), dbNSFP,
// AlphaMissense (Google DeepMind, via dbNSFP), MyVariant.info (BioThings),
// Ensembl (EMBL-EBI), UniProt, GTEx, and HPO (Jackson Laboratory).
// ---------------------------------------------------------------------------

const MYVARIANT = "https://myvariant.info/v1";
const HPO = "https://ontology.jax.org/api/network";
const GNOMAD = "https://gnomad.broadinstitute.org/api";
const EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const ENSEMBL = "https://rest.ensembl.org";
const UNIPROT = "https://rest.uniprot.org/uniprotkb";
const GTEX = "https://gtexportal.org/api/v2";
const LITVAR = "https://www.ncbi.nlm.nih.gov/research/litvar2-api";

const TIMEOUT = 8000;

async function getJson(url: string, init?: RequestInit, timeoutMs = TIMEOUT): Promise<any> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "variant-resolution-planner/prototype",
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

export interface AnnotateInput {
  gene?: string;
  entrezId?: string;
  genomicId?: string; // MyVariant genomic id, e.g. "chr14:g.23415267C>T" (hg38)
  rsId?: string;
}

export interface Annotation {
  retrievedAt: string;
  sources: string[];
  errors: string[];
  population?: {
    gnomadAF: number | null;
    ac?: number;
    an?: number;
    dataset?: string;
    source: string;
    note: string;
  };
  computational?: {
    revel?: number;
    cadd?: number;
    sift?: string;
    polyphen?: string;
    alphamissense?: { score?: number; pred?: string };
    source: string;
    note: string;
  };
  clinvar?: {
    variantId?: number;
    total: number;
    significances: Record<string, number>;
    reviewStatus?: string;
    stars?: number;
    lastEvaluated?: string;
    classification?: string;
    conditions?: number;
    accession?: string;
    source: string;
    note: string;
  };
  geneConstraint?: {
    pli?: number;
    loeuf?: number;
    misZ?: number;
    source: string;
    note: string;
  };
  consequence?: {
    mostSevere?: string;
    terms: string[];
    proteinStart?: number;
    aminoAcids?: string;
    derivedType?: string;
    derivedSpliceProximity?: string;
    source: string;
    note: string;
  };
  domain?: {
    inDomain: boolean;
    domainName?: string;
    allDomains: { name: string; start: number; end: number }[];
    source: string;
    note: string;
  };
  expression?: {
    accessibleForRNA: boolean;
    tissues: Record<string, number>;
    source: string;
    note: string;
  };
  literature?: { pmidCount: number; source: string; note: string };
  panelApp?: {
    topPanel?: string;
    confidenceLevel?: number;
    confidenceLabel?: string;
    moi?: string;
    derivedValidity?: string; // definitive|strong|moderate|limited|unknown
    derivedInheritance?: string; // autosomal-dominant|autosomal-recessive|x-linked|unknown
    panelCount: number;
    source: string;
    note: string;
  };
  g2p?: {
    records: { disease: string; genotype?: string; confidence?: string; mechanism?: string }[];
    allelicRequirement?: string; // monoallelic|biallelic|both|unknown
    source: string;
    note: string;
  };
  gene?: {
    symbol?: string;
    entrezId?: string;
    hpoPhenotypes: { id: string; name: string }[];
    diseases: { id: string; name: string }[];
    source: string;
  };
}

function firstNum(v: unknown): number | undefined {
  if (typeof v === "number") return v;
  if (Array.isArray(v) && typeof v[0] === "number") return v[0];
  return undefined;
}
function firstStr(v: unknown): string | undefined {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return undefined;
}

// --- MyVariant (gnomAD AF, dbNSFP incl AlphaMissense, ClinVar) --------------
function extractVariant(doc: any, ann: Annotation): void {
  if (!doc || typeof doc !== "object") return;

  const gAf = firstNum(doc?.gnomad_genome?.af?.af);
  const eAf = firstNum(doc?.gnomad_exome?.af?.af);
  const af = gAf ?? eAf ?? null;
  ann.population = {
    gnomadAF: af,
    dataset: "gnomAD (via MyVariant.info; older release)",
    source: "gnomAD (via MyVariant.info; older release)",
    note:
      af === null
        ? "Absent from gnomAD (no observed alleles reported)."
        : `gnomAD allele frequency ${af.toExponential(2)} (${
            af < 1e-4
              ? "rare"
              : af < 1e-3
              ? "low frequency — check gene/disease-specific thresholds"
              : "appreciable — may warrant a benign-direction frequency review"
          }).`,
  };

  const revel = firstNum(doc?.dbnsfp?.revel?.score);
  const cadd = firstNum(doc?.dbnsfp?.cadd?.phred);
  const sift = firstStr(doc?.dbnsfp?.sift?.pred);
  const polyphen = firstStr(doc?.dbnsfp?.polyphen2?.hdiv?.pred);
  const amScore = firstNum(doc?.dbnsfp?.alphamissense?.score);
  const amPred = firstStr(doc?.dbnsfp?.alphamissense?.pred);
  if (revel !== undefined || cadd !== undefined || sift || polyphen || amScore !== undefined) {
    const bits: string[] = [];
    if (revel !== undefined) bits.push(`REVEL ${revel}`);
    if (cadd !== undefined) bits.push(`CADD ${cadd}`);
    if (amScore !== undefined)
      bits.push(`AlphaMissense ${amScore}${amPred ? ` (${amPred === "P" ? "likely pathogenic-class" : amPred === "B" ? "likely benign-class" : amPred})` : ""}`);
    if (sift) bits.push(`SIFT ${sift}`);
    if (polyphen) bits.push(`PolyPhen2 ${polyphen}`);
    ann.computational = {
      revel,
      cadd,
      sift,
      polyphen,
      alphamissense: amScore !== undefined ? { score: amScore, pred: amPred } : undefined,
      source: "dbNSFP incl. AlphaMissense (via MyVariant.info)",
      note: `In-silico predictors already available: ${bits.join(", ")}. Correlated predictors are capped as a single evidence line.`,
    };
  }

  const cv = doc?.clinvar;
  if (cv) {
    const rcv = Array.isArray(cv.rcv) ? cv.rcv : cv.rcv ? [cv.rcv] : [];
    const significances: Record<string, number> = {};
    for (const r of rcv) {
      const s = r?.clinical_significance;
      if (s) significances[s] = (significances[s] ?? 0) + 1;
    }
    ann.clinvar = {
      variantId: typeof cv.variant_id === "number" ? cv.variant_id : undefined,
      total: rcv.length,
      significances,
      source: "ClinVar (via MyVariant.info)",
      // Provisional note; rebuilt from the current NCBI ClinVar record in
      // fetchClinvarReview() so the displayed classification/review is current.
      note:
        rcv.length > 0
          ? `ClinVar record present (aggregate classification pending live refresh). Shown as external context; this tool does not itself classify.`
          : "No ClinVar record found.",
    };
  }
}

async function fetchVariant(input: AnnotateInput, ann: Annotation): Promise<void> {
  const fields =
    "gnomad_genome.af.af,gnomad_exome.af.af,clinvar.rcv.clinical_significance,clinvar.variant_id,dbnsfp.revel.score,dbnsfp.cadd.phred,dbnsfp.sift.pred,dbnsfp.polyphen2.hdiv.pred,dbnsfp.alphamissense";
  try {
    if (input.genomicId) {
      const doc = await getJson(
        `${MYVARIANT}/variant/${encodeURIComponent(input.genomicId)}?assembly=hg38&fields=${fields}`
      );
      extractVariant(doc, ann);
      ann.sources.push("MyVariant.info");
    } else if (input.rsId) {
      const q = await getJson(
        `${MYVARIANT}/query?q=dbsnp.rsid:${encodeURIComponent(input.rsId)}&assembly=hg38&size=1&fields=${fields}`
      );
      const hit = Array.isArray(q?.hits) ? q.hits[0] : undefined;
      if (hit) {
        extractVariant(hit, ann);
        ann.sources.push("MyVariant.info");
      } else ann.errors.push("MyVariant.info: no variant found for rsID");
    }
  } catch (err) {
    ann.errors.push(`MyVariant.info: ${err instanceof Error ? err.message : "error"}`);
  }
}

// --- gnomAD gene constraint -------------------------------------------------
async function fetchGeneConstraint(input: AnnotateInput, ann: Annotation): Promise<void> {
  if (!input.gene) return;
  try {
    const body = {
      query: `{gene(gene_symbol:"${input.gene}",reference_genome:GRCh38){gnomad_constraint{pli oe_lof_upper mis_z}}}`,
    };
    const data = await getJson(GNOMAD, { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
    const gc = data?.data?.gene?.gnomad_constraint;
    if (gc) {
      const pli = typeof gc.pli === "number" ? gc.pli : undefined;
      const loeuf = typeof gc.oe_lof_upper === "number" ? gc.oe_lof_upper : undefined;
      const misZ = typeof gc.mis_z === "number" ? gc.mis_z : undefined;
      const notes: string[] = [];
      if (loeuf !== undefined) notes.push(`LOEUF ${loeuf.toFixed(2)} (${loeuf < 0.35 ? "LoF-intolerant" : loeuf > 1 ? "LoF-tolerant" : "intermediate"})`);
      if (misZ !== undefined) notes.push(`missense-z ${misZ.toFixed(1)} (${misZ >= 3.09 ? "strongly missense-constrained" : misZ >= 1 ? "some missense constraint" : "not missense-constrained"})`);
      if (pli !== undefined) notes.push(`pLI ${pli.toFixed(2)}`);
      ann.geneConstraint = {
        pli,
        loeuf,
        misZ,
        source: "gnomAD gene constraint",
        note: `Gene-level constraint: ${notes.join(", ")}.`,
      };
      ann.sources.push("gnomAD constraint");
    }
  } catch (err) {
    ann.errors.push(`gnomAD constraint: ${err instanceof Error ? err.message : "error"}`);
  }
}

// --- gnomAD v4 variant allele frequency (direct, authoritative) -------------
function toGnomadVariantId(genomicId?: string): string | undefined {
  if (!genomicId) return undefined;
  const m = /^chr([\dXYM]+):g\.(\d+)([ACGT]+)>([ACGT]+)$/i.exec(genomicId.trim());
  return m ? `${m[1]}-${m[2]}-${m[3]}-${m[4]}` : undefined;
}
function freqBand(af: number): string {
  return af < 1e-4
    ? "rare"
    : af < 1e-3
    ? "low frequency — check gene/disease-specific thresholds"
    : "appreciable — may warrant a benign-direction frequency review";
}
async function fetchGnomadVariantAF(input: AnnotateInput, ann: Annotation): Promise<void> {
  const vid = toGnomadVariantId(input.genomicId);
  if (!vid) return;
  try {
    const body = {
      query: `{variant(variantId:"${vid}",dataset:gnomad_r4){genome{af ac an}exome{af ac an}}}`,
    };
    const data = await getJson(GNOMAD, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
    const v = data?.data?.variant;
    if (!v) return;
    const ex = v.exome;
    const ge = v.genome;
    // Report the larger cohort as primary (do not naively sum exome+genome).
    const primary = ex?.af != null ? ex : ge;
    if (!primary || primary.af == null) return;
    const both =
      ex?.af != null && ge?.af != null
        ? ` (exome ${Number(ex.af).toExponential(2)}, genome ${Number(ge.af).toExponential(2)})`
        : "";
    ann.population = {
      gnomadAF: primary.af,
      ac: primary.ac,
      an: primary.an,
      dataset: "gnomAD v4.1 (GRCh38)",
      source: "gnomAD v4 (direct)",
      note: `gnomAD v4 allele frequency ${Number(primary.af).toExponential(2)}${both}; AC ${primary.ac}/AN ${primary.an} (${freqBand(primary.af)}).`,
    };
    ann.sources.push("gnomAD v4");
  } catch (err) {
    ann.errors.push(`gnomAD v4 variant: ${err instanceof Error ? err.message : "error"}`);
  }
}

// --- Ensembl VEP ------------------------------------------------------------
function deriveType(mostSevere?: string): string | undefined {
  if (!mostSevere) return undefined;
  if (mostSevere.includes("missense")) return "missense";
  if (mostSevere.includes("synonymous")) return "synonymous";
  if (mostSevere.includes("stop_gained")) return "nonsense";
  if (mostSevere.includes("frameshift")) return "frameshift";
  if (mostSevere.includes("splice")) return "splice-region";
  if (mostSevere.includes("inframe")) return "in-frame-indel";
  return "other";
}
function deriveSpliceProximity(terms: string[]): string {
  if (terms.some((t) => t === "splice_donor_variant" || t === "splice_acceptor_variant")) return "canonical";
  if (terms.some((t) => t.includes("splice"))) return "splice-region";
  return "distant";
}
async function fetchVep(input: AnnotateInput, ann: Annotation): Promise<void> {
  if (!input.rsId) return; // VEP-by-id is the most reliable path here
  try {
    // Ensembl VEP is the slowest source; give it more headroom so it does not
    // abort (UniProt domain placement depends on its protein position).
    const arr = await getJson(
      `${ENSEMBL}/vep/human/id/${encodeURIComponent(input.rsId)}?content-type=application/json`,
      undefined,
      18000
    );
    const rec = Array.isArray(arr) ? arr[0] : arr;
    if (!rec) return;
    const tcs = Array.isArray(rec.transcript_consequences) ? rec.transcript_consequences : [];
    const tc = (input.gene && tcs.find((c: any) => c.gene_symbol === input.gene)) || tcs[0] || {};
    const terms: string[] = Array.isArray(tc.consequence_terms) ? tc.consequence_terms : [];
    ann.consequence = {
      mostSevere: rec.most_severe_consequence,
      terms,
      proteinStart: typeof tc.protein_start === "number" ? tc.protein_start : undefined,
      aminoAcids: tc.amino_acids,
      derivedType: deriveType(rec.most_severe_consequence),
      derivedSpliceProximity: deriveSpliceProximity(terms),
      source: "Ensembl VEP",
      note: `Ensembl VEP most severe consequence: ${rec.most_severe_consequence}${tc.protein_start ? `; protein position ${tc.protein_start}` : ""}.`,
    };
    ann.sources.push("Ensembl VEP");
  } catch (err) {
    ann.errors.push(`Ensembl VEP: ${err instanceof Error ? err.message : "error"}`);
  }
}

// --- ClinVar review status (eutils) ----------------------------------------
function reviewStars(status?: string): number {
  if (!status) return 0;
  const s = status.toLowerCase();
  if (s.includes("practice guideline")) return 4;
  if (s.includes("expert panel")) return 3;
  if (s.includes("multiple submitters") && s.includes("no conflicts")) return 2;
  if (s.includes("conflicting")) return 1;
  if (s.includes("single submitter")) return 1;
  return 0;
}
async function fetchClinvarReview(ann: Annotation): Promise<void> {
  const id = ann.clinvar?.variantId;
  if (!id) return;
  try {
    const data = await getJson(`${EUTILS}/esummary.fcgi?db=clinvar&id=${id}&retmode=json`);
    const rec = data?.result?.[String(id)];
    // Prefer the current "germline_classification" block (newer ClinVar schema).
    const cs = rec?.germline_classification ?? rec?.clinical_significance;
    const reviewStatus: string | undefined = cs?.review_status;
    if (cs && ann.clinvar) {
      const stars = reviewStars(reviewStatus);
      const desc: string | undefined = cs.description;
      const nCond = Array.isArray(cs.trait_set) ? cs.trait_set.length : undefined;
      const acc: string | undefined = rec?.accession;
      ann.clinvar.reviewStatus = reviewStatus;
      ann.clinvar.stars = stars;
      ann.clinvar.lastEvaluated = cs.last_evaluated;
      ann.clinvar.classification = desc;
      ann.clinvar.conditions = nCond;
      ann.clinvar.accession = acc;
      // Rebuild the note from the CURRENT ClinVar record (not MyVariant's cached
      // RCV list). Lead with classification + review status + star rating; the
      // star rating already encodes "multiple submitters", so we do not report a
      // potentially-stale submission count.
      ann.clinvar.note = `ClinVar ${acc ?? "record"}: ${desc ?? "see record"} (${stars}\u2605, "${reviewStatus}")${
        nCond ? `, ${nCond} associated condition(s)` : ""
      }. Shown as external case-level context; this tool does not itself classify.`;
      ann.sources.push("NCBI ClinVar");
    }
  } catch (err) {
    ann.errors.push(`ClinVar review: ${err instanceof Error ? err.message : "error"}`);
  }
}

// --- UniProt protein domains ------------------------------------------------
async function fetchDomain(input: AnnotateInput, ann: Annotation): Promise<void> {
  if (!input.gene) return;
  const residue = ann.consequence?.proteinStart;
  try {
    const search = await getJson(
      `${UNIPROT}/search?query=gene_exact:${encodeURIComponent(input.gene)}+AND+organism_id:9606+AND+reviewed:true&fields=accession&format=json&size=1`
    );
    const acc = search?.results?.[0]?.primaryAccession;
    if (!acc) {
      ann.errors.push("UniProt: no reviewed accession found");
      return;
    }
    const entry = await getJson(`${UNIPROT}/${acc}?fields=ft_domain&format=json`);
    const domains = (Array.isArray(entry?.features) ? entry.features : [])
      .filter((f: any) => f?.type === "Domain" && f?.location?.start?.value && f?.location?.end?.value)
      .map((f: any) => ({ name: f.description ?? "domain", start: f.location.start.value, end: f.location.end.value }));
    let inDomain = false;
    let domainName: string | undefined;
    if (typeof residue === "number") {
      const hit = domains.find((d: any) => residue >= d.start && residue <= d.end);
      if (hit) {
        inDomain = true;
        domainName = hit.name;
      }
    }
    ann.domain = {
      inDomain,
      domainName,
      allDomains: domains,
      source: `UniProt ${acc}`,
      note:
        typeof residue !== "number"
          ? `UniProt annotated domains: ${domains.map((d: any) => d.name).join("; ") || "none"}.`
          : inDomain
          ? `Residue ${residue} lies in the ${domainName} domain (UniProt).`
          : `Residue ${residue} is not within a UniProt-annotated functional domain (e.g. outside the ${domains[1]?.name ?? "motor"} domain).`,
    };
    ann.sources.push("UniProt");
  } catch (err) {
    ann.errors.push(`UniProt: ${err instanceof Error ? err.message : "error"}`);
  }
}

// --- GTEx tissue expression -------------------------------------------------
async function fetchExpression(input: AnnotateInput, ann: Annotation): Promise<void> {
  if (!input.gene) return;
  try {
    const ref = await getJson(`${GTEX}/reference/gene?geneId=${encodeURIComponent(input.gene)}`);
    const gencodeId = ref?.data?.[0]?.gencodeId;
    if (!gencodeId) {
      ann.errors.push("GTEx: gene not found");
      return;
    }
    const exp = await getJson(
      `${GTEX}/expression/medianGeneExpression?gencodeId=${encodeURIComponent(gencodeId)}&datasetId=gtex_v8`
    );
    const rows = Array.isArray(exp?.data) ? exp.data : [];
    const tissues: Record<string, number> = {};
    for (const r of rows) {
      if (r?.tissueSiteDetailId && typeof r.median === "number") tissues[r.tissueSiteDetailId] = r.median;
    }
    const blood = tissues["Whole_Blood"] ?? 0;
    const fibro = tissues["Cells_Cultured_fibroblasts"] ?? 0;
    const accessibleForRNA = blood >= 5 || fibro >= 5;
    ann.expression = {
      accessibleForRNA,
      tissues: {
        Whole_Blood: blood,
        Cells_Cultured_fibroblasts: fibro,
        ...(tissues["Heart_Left_Ventricle"] !== undefined ? { Heart_Left_Ventricle: tissues["Heart_Left_Ventricle"] } : {}),
      },
      source: "GTEx v8",
      note: accessibleForRNA
        ? `Gene expressed in accessible tissue (blood ${blood.toFixed(1)} / fibroblast ${fibro.toFixed(1)} TPM) \u2014 RNA study feasible from accessible sample.`
        : `Low expression in accessible tissue (blood ${blood.toFixed(1)} / fibroblast ${fibro.toFixed(1)} TPM) \u2014 a minigene assay or relevant-tissue sample may be required for RNA study.`,
    };
    ann.sources.push("GTEx");
  } catch (err) {
    ann.errors.push(`GTEx: ${err instanceof Error ? err.message : "error"}`);
  }
}

// --- LitVar2 publication count ----------------------------------------------
async function fetchLiterature(input: AnnotateInput, ann: Annotation): Promise<void> {
  if (!input.rsId) return;
  try {
    const data = await getJson(`${LITVAR}/variant/get/litvar@${encodeURIComponent(input.rsId)}%23%23/publications`);
    const count = typeof data?.pmids_count === "number" ? data.pmids_count : Array.isArray(data?.pmids) ? data.pmids.length : 0;
    ann.literature = {
      pmidCount: count,
      source: "LitVar2 (NCBI)",
      note: `${count} publication(s) mention this variant (LitVar2). These require expert appraisal; a count is a pointer, not case-level evidence in itself.`,
    };
    ann.sources.push("LitVar2");
  } catch (err) {
    ann.errors.push(`LitVar2: ${err instanceof Error ? err.message : "error"}`);
  }
}

// --- PanelApp (gene-disease validity + mode of inheritance) -----------------
const PANELAPP = "https://panelapp.genomicsengland.co.uk/api/v1";

function moiToInheritance(moi?: string): string | undefined {
  if (!moi) return undefined;
  const s = moi.toUpperCase();
  if (s.includes("X-LINKED") || s.includes("X LINKED")) return "x-linked";
  const mono = s.includes("MONOALLELIC");
  const bi = s.includes("BIALLELIC");
  if (mono && bi) return undefined; // ambiguous ("both")
  if (bi) return "autosomal-recessive";
  if (mono) return "autosomal-dominant";
  return undefined;
}
function confidenceToValidity(level?: number): string | undefined {
  if (level === undefined) return undefined;
  if (level >= 3) return "strong"; // green = high-evidence / diagnostic-grade
  if (level === 2) return "moderate"; // amber
  if (level <= 1) return "limited"; // red / low
  return undefined;
}
async function fetchPanelApp(input: AnnotateInput, ann: Annotation): Promise<void> {
  if (!input.gene) return;
  try {
    const data = await getJson(
      `${PANELAPP}/genes/?entity_name=${encodeURIComponent(input.gene)}&format=json`
    );
    const results = Array.isArray(data?.results) ? data.results : [];
    if (results.length === 0) return;
    // Prefer the highest-confidence panel entry.
    let top = results[0];
    for (const r of results) {
      if (Number(r?.confidence_level ?? 0) > Number(top?.confidence_level ?? 0)) top = r;
    }
    const level = Number(top?.confidence_level);
    const labels: Record<number, string> = { 3: "green (high)", 2: "amber (moderate)", 1: "red (low)", 0: "red (low)" };
    const moi: string | undefined = top?.mode_of_inheritance;
    ann.panelApp = {
      topPanel: top?.panel?.name,
      confidenceLevel: Number.isFinite(level) ? level : undefined,
      confidenceLabel: labels[level],
      moi,
      derivedValidity: confidenceToValidity(level),
      derivedInheritance: moiToInheritance(moi),
      panelCount: results.length,
      source: "PanelApp (Genomics England)",
      note: `PanelApp: ${top?.panel?.name} rated ${labels[level] ?? "?"}; mode of inheritance "${moi ?? "n/a"}" (across ${results.length} panels).`,
    };
    ann.sources.push("PanelApp");
  } catch (err) {
    ann.errors.push(`PanelApp: ${err instanceof Error ? err.message : "error"}`);
  }
}

// --- gene2phenotype (allelic requirement / inheritance) ---------------------
async function fetchG2P(input: AnnotateInput, ann: Annotation): Promise<void> {
  if (!input.gene) return;
  try {
    const data = await getJson(
      `https://www.ebi.ac.uk/gene2phenotype/api/search/?type=gene&query=${encodeURIComponent(input.gene)}`
    );
    const results = Array.isArray(data?.results) ? data.results : [];
    if (results.length === 0) return;
    const records = results.slice(0, 6).map((r: any) => ({
      disease: r?.disease,
      genotype: r?.genotype,
      confidence: r?.confidence,
      mechanism: r?.mechanism,
    }));
    const genotypes = new Set<string>(records.map((r: any) => String(r.genotype ?? "")));
    const anyMono = [...genotypes].some((g: string) => g.includes("monoallelic"));
    const anyBi = [...genotypes].some((g: string) => g.includes("biallelic"));
    const allelicRequirement = anyMono && anyBi ? "both" : anyBi ? "biallelic" : anyMono ? "monoallelic" : "unknown";
    ann.g2p = {
      records,
      allelicRequirement,
      source: "gene2phenotype (EBI)",
      note: `gene2phenotype: ${records.length} gene-disease record(s); allelic requirement ${allelicRequirement}.`,
    };
    ann.sources.push("gene2phenotype");
  } catch (err) {
    ann.errors.push(`gene2phenotype: ${err instanceof Error ? err.message : "error"}`);
  }
}

// --- HPO gene -> phenotype --------------------------------------------------
async function fetchGenePhenotypes(input: AnnotateInput, ann: Annotation): Promise<void> {
  if (!input.gene && !input.entrezId) return;
  try {
    let entrez = input.entrezId;
    let symbol = input.gene;
    if (!entrez && input.gene) {
      const search = await getJson(`${HPO}/search/gene?q=${encodeURIComponent(input.gene)}&limit=1`);
      const g = Array.isArray(search?.results) ? search.results[0] : undefined;
      if (g?.id) {
        entrez = String(g.id).split(":").pop();
        symbol = g.name ?? symbol;
      }
    }
    if (!entrez) {
      ann.errors.push("HPO: could not resolve gene to an NCBI Gene id");
      return;
    }
    const data = await getJson(`${HPO}/annotation/NCBIGene:${entrez}`);
    const phenotypes = (Array.isArray(data?.phenotypes) ? data.phenotypes : [])
      .filter((p: any) => p?.id && p?.name)
      .map((p: any) => ({ id: p.id, name: p.name }));
    const diseases = (Array.isArray(data?.diseases) ? data.diseases : [])
      .filter((d: any) => d?.id && d?.name)
      .map((d: any) => ({ id: d.id, name: d.name }));
    ann.gene = {
      symbol,
      entrezId: entrez,
      hpoPhenotypes: phenotypes,
      diseases,
      source: "Human Phenotype Ontology (ontology.jax.org)",
    };
    ann.sources.push("HPO");
  } catch (err) {
    ann.errors.push(`HPO: ${err instanceof Error ? err.message : "error"}`);
  }
}

export async function fetchAnnotation(input: AnnotateInput): Promise<Annotation> {
  const ann: Annotation = { retrievedAt: new Date().toISOString(), sources: [], errors: [] };

  // Phase 1: independent lookups in parallel.
  await Promise.all([
    fetchVariant(input, ann),
    fetchGeneConstraint(input, ann),
    fetchVep(input, ann),
    fetchExpression(input, ann),
    fetchLiterature(input, ann),
    fetchGenePhenotypes(input, ann),
    fetchPanelApp(input, ann),
    fetchG2P(input, ann),
  ]);

  // Phase 2: dependent / authoritative lookups (ClinVar review needs the
  // variantId from MyVariant; UniProt domain needs the protein position from
  // VEP; gnomAD v4 overrides the older MyVariant frequency when available).
  await Promise.all([
    fetchClinvarReview(ann),
    fetchDomain(input, ann),
    fetchGnomadVariantAF(input, ann),
  ]);

  // De-duplicate sources.
  ann.sources = Array.from(new Set(ann.sources));
  return ann;
}
