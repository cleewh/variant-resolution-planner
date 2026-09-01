// ---------------------------------------------------------------------------
// Live annotation client. Calls the backend /annotate endpoint, which queries
// real knowledgebases (gnomAD/ClinVar/dbNSFP via MyVariant.info, and HPO) and
// returns provenance-tagged data. Maps the result onto the case's evidence
// with source badges. Requires a configured backend (same resolution as the
// Bedrock explain endpoint).
// ---------------------------------------------------------------------------

import type {
  GeneDiseaseValidity,
  HpoTerm,
  InheritanceModel,
  VariantCase,
} from "../engine/types";
import { getApiUrl } from "./explain";

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
  geneConstraint?: { pli?: number; loeuf?: number; misZ?: number; source: string; note: string };
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
  expression?: { accessibleForRNA: boolean; tissues: Record<string, number>; source: string; note: string };
  literature?: { pmidCount: number; source: string; note: string };
  panelApp?: {
    topPanel?: string;
    confidenceLevel?: number;
    confidenceLabel?: string;
    moi?: string;
    derivedValidity?: string;
    derivedInheritance?: string;
    panelCount: number;
    source: string;
    note: string;
  };
  g2p?: {
    records: { disease: string; genotype?: string; confidence?: string; mechanism?: string }[];
    allelicRequirement?: string;
    source: string;
    note: string;
  };
  gene?: {
    symbol?: string;
    entrezId?: string;
    hpoPhenotypes: HpoTerm[];
    diseases: { id: string; name: string }[];
    source: string;
  };
}

export interface AnnotateResult {
  annotation?: Annotation;
  error?: string;
}

export function caseSupportsLiveLookup(c: VariantCase): boolean {
  return Boolean(c.variant.genomicId || c.variant.rsId || c.gene || c.entrezId);
}

export async function fetchAnnotation(c: VariantCase): Promise<AnnotateResult> {
  const apiUrl = await getApiUrl();
  if (!apiUrl) {
    return { error: "No backend configured for live lookups (set VITE_API_URL or deploy)." };
  }
  try {
    const res = await fetch(`${apiUrl}/annotate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gene: c.gene,
        entrezId: c.entrezId,
        genomicId: c.variant.genomicId,
        rsId: c.variant.rsId,
      }),
    });
    if (!res.ok) return { error: `Annotation backend returned ${res.status}` };
    return { annotation: (await res.json()) as Annotation };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Annotation request failed" };
  }
}

/** Apply a live annotation onto a case, populating evidence + derived fields with provenance. */
export function applyAnnotation(c: VariantCase, ann: Annotation): VariantCase {
  const next: VariantCase = JSON.parse(JSON.stringify(c)) as VariantCase;
  const at = ann.retrievedAt;
  const ctx: { label: string; value: string; source: string }[] = [];

  if (ann.population) {
    next.evidence.population = {
      status: "present",
      detail: ann.population.note,
      source: "gnomAD (live)",
      retrievedAt: at,
    };
    ctx.push({
      label: "gnomAD frequency",
      value:
        ann.population.gnomadAF === null
          ? "absent"
          : `${ann.population.gnomadAF.toExponential(2)}${
              ann.population.ac != null ? ` (AC ${ann.population.ac}/AN ${ann.population.an})` : ""
            }`,
      source: ann.population.dataset ?? ann.population.source,
    });
  }

  if (ann.computational) {
    next.evidence.computational = {
      status: "present",
      detail: ann.computational.note,
      source: "dbNSFP (live)",
      retrievedAt: at,
    };
    const am = ann.computational.alphamissense;
    ctx.push({
      label: "In-silico",
      value: [
        ann.computational.revel !== undefined ? `REVEL ${ann.computational.revel}` : null,
        am?.score !== undefined ? `AlphaMissense ${am.score}${am.pred ? ` (${am.pred})` : ""}` : null,
      ]
        .filter(Boolean)
        .join(", "),
      source: ann.computational.source,
    });
  }

  if (ann.clinvar) {
    const onlyUncertain =
      Object.keys(ann.clinvar.significances).length === 1 &&
      Object.keys(ann.clinvar.significances).some((s) => /uncertain/i.test(s));
    let detail = ann.clinvar.note;
    if (ann.literature) detail += ` ${ann.literature.note}`;
    next.evidence.caseLevel = {
      status: ann.clinvar.total === 0 ? "absent" : onlyUncertain ? "partial" : "present",
      detail,
      source: "ClinVar + LitVar (live)",
      retrievedAt: at,
    };
    ctx.push({
      label: "ClinVar (external)",
      value: `${ann.clinvar.classification ?? Object.keys(ann.clinvar.significances)[0] ?? "see record"}${
        ann.clinvar.stars !== undefined ? ` \u00b7 ${ann.clinvar.stars}\u2605` : ""
      }`,
      source: ann.clinvar.accession ? `ClinVar ${ann.clinvar.accession} (NCBI)` : "ClinVar (NCBI)",
    });
  }
  if (ann.literature) {
    ctx.push({ label: "Publications", value: `${ann.literature.pmidCount}`, source: ann.literature.source });
  }

  // Derive real molecular consequence -> variant type + splice proximity.
  if (ann.consequence) {
    if (ann.consequence.derivedType) {
      next.variant.type = ann.consequence.derivedType as VariantCase["variant"]["type"];
    }
    if (ann.consequence.derivedSpliceProximity) {
      next.variant.spliceProximity =
        ann.consequence.derivedSpliceProximity as VariantCase["variant"]["spliceProximity"];
    }
    ctx.push({
      label: "Consequence (VEP)",
      value: `${ann.consequence.mostSevere ?? "?"}${ann.consequence.proteinStart ? ` @ residue ${ann.consequence.proteinStart}` : ""}`,
      source: ann.consequence.source,
    });
  }

  // Gene constraint (mechanism context).
  if (ann.geneConstraint) {
    next.geneConstraint = {
      pli: ann.geneConstraint.pli,
      loeuf: ann.geneConstraint.loeuf,
      misZ: ann.geneConstraint.misZ,
      note: ann.geneConstraint.note,
    };
    ctx.push({
      label: "gnomAD constraint",
      value: [
        ann.geneConstraint.loeuf !== undefined ? `LOEUF ${ann.geneConstraint.loeuf.toFixed(2)}` : null,
        ann.geneConstraint.misZ !== undefined ? `mis-z ${ann.geneConstraint.misZ.toFixed(1)}` : null,
      ]
        .filter(Boolean)
        .join(", "),
      source: ann.geneConstraint.source,
    });
  }

  // Protein domain (real PM1-type context).
  if (ann.domain) {
    next.variant.inCriticalDomain = ann.domain.inDomain;
    next.variant.criticalDomainName = ann.domain.domainName;
    ctx.push({
      label: "Protein domain",
      value: ann.domain.inDomain ? (ann.domain.domainName ?? "in domain") : "outside annotated domain",
      source: ann.domain.source,
    });
  }

  // Tissue expression -> RNA-study feasibility.
  if (ann.expression) {
    next.rnaTissueAccessible = ann.expression.accessibleForRNA;
    ctx.push({
      label: "Expression (RNA feasibility)",
      value: ann.expression.accessibleForRNA ? "expressed in accessible tissue" : "low in blood/fibroblast",
      source: ann.expression.source,
    });
  }

  // Gene-disease validity + mode of inheritance (PanelApp), and allelic
  // requirement (gene2phenotype). Deriving these replaces hand-set inputs with
  // real curation.
  if (ann.panelApp) {
    if (ann.panelApp.derivedValidity) {
      next.geneDiseaseValidity = ann.panelApp.derivedValidity as GeneDiseaseValidity;
    }
    // Only fill the inheritance model if the case did not assert one, so we
    // don't silently override a specific working hypothesis.
    if (ann.panelApp.derivedInheritance && next.inheritanceModel === "unknown") {
      next.inheritanceModel = ann.panelApp.derivedInheritance as InheritanceModel;
    }
    ctx.push({
      label: "Gene-disease validity (PanelApp)",
      value: `${ann.panelApp.confidenceLabel ?? ann.panelApp.derivedValidity ?? "?"}${
        ann.panelApp.topPanel ? ` — ${ann.panelApp.topPanel}` : ""
      }`,
      source: ann.panelApp.source,
    });
    if (ann.panelApp.moi) {
      ctx.push({
        label: "Mode of inheritance (PanelApp)",
        value: ann.panelApp.moi,
        source: ann.panelApp.source,
      });
    }
  }
  if (ann.g2p?.allelicRequirement) {
    ctx.push({
      label: "Allelic requirement (gene2phenotype)",
      value: ann.g2p.allelicRequirement,
      source: ann.g2p.source,
    });
  }

  if (ann.gene) {
    next.liveHpoPhenotypes = ann.gene.hpoPhenotypes;
    next.liveDiseases = ann.gene.diseases;
    if (ann.gene.entrezId) next.entrezId = ann.gene.entrezId;
  }

  next.liveContext = ctx;
  return next;
}
