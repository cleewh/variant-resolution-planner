import { useState } from "react";
import type {
  DiseasePrevalence,
  EvidenceCategoryKey,
  EvidenceStatus,
  InheritanceModel,
  VariantCase,
  VariantType,
  ZygosityCategory,
} from "../engine/types";
import { CATEGORY_LABELS } from "../engine/labels";
import { StatusChip } from "./ui";
import { DEMO_CASES } from "../data/cases";

const EDITABLE_CATEGORIES: EvidenceCategoryKey[] = [
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

const INHERITANCE_MODELS: InheritanceModel[] = [
  "autosomal-dominant",
  "autosomal-recessive",
  "x-linked",
  "de-novo-dominant",
  "unknown",
];

const ZYGOSITY_CATEGORIES: ZygosityCategory[] = [
  "heterozygous",
  "homozygous",
  "hemizygous",
  "compound-het-pending",
  "unknown",
];

const DISEASE_PREVALENCES: DiseasePrevalence[] = [
  "rare",
  "moderate",
  "common",
  "unknown",
];

const STATUS_OPTIONS: EvidenceStatus[] = [
  "present",
  "partial",
  "absent",
  "saturated",
  "unavailable",
  "contradictory",
  "notApplicable",
];

const VARIANT_TYPES: VariantType[] = [
  "missense",
  "splice-region",
  "nonsense",
  "frameshift",
  "in-frame-indel",
  "synonymous",
  "other",
];

export function CasePanel({
  variantCase,
  onChange,
  onLoadDemo,
  onFetchAnnotation,
  annotating,
  canFetchAnnotation,
  annotationNote,
}: {
  variantCase: VariantCase;
  onChange: (next: VariantCase) => void;
  onLoadDemo: (id: string) => void;
  onFetchAnnotation: () => void;
  annotating: boolean;
  canFetchAnnotation: boolean;
  annotationNote: string | null;
}) {
  const [editing, setEditing] = useState(false);

  const setEvidenceStatus = (key: EvidenceCategoryKey, status: EvidenceStatus) => {
    onChange({
      ...variantCase,
      evidence: {
        ...variantCase.evidence,
        [key]: { ...variantCase.evidence[key], status },
      },
    });
  };

  const setFamilyFlag = (
    flag:
      | "parentsAvailable"
      | "affectedRelativesAvailable"
      | "unaffectedRelativesAvailable"
      | "historyPresent"
      | "consanguinity",
    value: boolean
  ) => {
    onChange({
      ...variantCase,
      family: { ...variantCase.family, [flag]: value },
    });
  };

  const setVariantType = (type: VariantType) => {
    onChange({ ...variantCase, variant: { ...variantCase.variant, type } });
  };

  const setInheritanceModel = (inheritanceModel: InheritanceModel) => {
    onChange({ ...variantCase, inheritanceModel });
  };

  const setZygosity = (zygosityCategory: ZygosityCategory) => {
    onChange({
      ...variantCase,
      variant: { ...variantCase.variant, zygosityCategory },
    });
  };

  const setDiseasePrevalence = (diseasePrevalence: DiseasePrevalence) => {
    onChange({ ...variantCase, diseasePrevalence });
  };

  const setInformativeMeioses = (value: number | undefined) => {
    onChange({
      ...variantCase,
      family: { ...variantCase.family, informativeMeioses: value },
    });
  };

  return (
    <aside className="case-panel">
      <div className="panel-block">
        <label className="field-label" htmlFor="case-select">
          Demo case
        </label>
        <select
          id="case-select"
          value={variantCase.id}
          onChange={(e) => onLoadDemo(e.target.value)}
        >
          {DEMO_CASES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </div>

      <div className="synthetic-note">{variantCase.syntheticNotice}</div>

      <div className="panel-block">
        <button
          className="secondary-btn full"
          onClick={onFetchAnnotation}
          disabled={annotating || !canFetchAnnotation}
          title={
            canFetchAnnotation
              ? "Retrieve live gnomAD / ClinVar / dbNSFP / HPO data (requires backend)"
              : "Add a gene / rsID / genomic id to enable live lookup"
          }
        >
          {annotating ? "Fetching live data…" : "Fetch live annotations"}
        </button>
        <p className="muted live-sources">
          gnomAD · ClinVar · dbNSFP (via MyVariant.info) · HPO (Jax)
        </p>
        {annotationNote && <p className="annotation-note">{annotationNote}</p>}
      </div>

      {variantCase.liveContext && variantCase.liveContext.length > 0 && (
        <div className="panel-block">
          <h3>Live gene &amp; variant context</h3>
          <ul className="context-list">
            {variantCase.liveContext.map((item, i) => (
              <li key={i}>
                <span className="ctx-label">{item.label}</span>
                <span className="ctx-value">{item.value}</span>
                <span className="ctx-source">{item.source}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="panel-block">
        <h3>Case summary</h3>
        <p className="muted">{variantCase.patient.summary}</p>
      </div>

      <div className="panel-block kv">
        <div>
          <span className="k">Suspected disease</span>
          <span className="v">{variantCase.patient.suspectedDisease}</span>
        </div>
        <div>
          <span className="k">Gene</span>
          <span className="v mono">{variantCase.gene}</span>
        </div>
        <div>
          <span className="k">Variant</span>
          <span className="v mono">{variantCase.variant.hgvs}</span>
        </div>
        <div>
          <span className="k">Variant type</span>
          {editing ? (
            <select
              value={variantCase.variant.type}
              onChange={(e) => setVariantType(e.target.value as VariantType)}
            >
              {VARIANT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          ) : (
            <span className="v">{variantCase.variant.type}</span>
          )}
        </div>
        <div>
          <span className="k">Zygosity</span>
          {editing ? (
            <select
              value={variantCase.variant.zygosityCategory ?? "unknown"}
              onChange={(e) => setZygosity(e.target.value as ZygosityCategory)}
            >
              {ZYGOSITY_CATEGORIES.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          ) : (
            <span className="v">{variantCase.variant.zygosity}</span>
          )}
        </div>
        <div>
          <span className="k">Disease prevalence</span>
          {editing ? (
            <select
              value={variantCase.diseasePrevalence ?? "unknown"}
              onChange={(e) =>
                setDiseasePrevalence(e.target.value as DiseasePrevalence)
              }
            >
              {DISEASE_PREVALENCES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          ) : (
            <span className="v">{variantCase.diseasePrevalence ?? "unknown"}</span>
          )}
        </div>
        <div>
          <span className="k">Inheritance</span>
          <span className="v">{variantCase.inheritance}</span>
        </div>
        <div>
          <span className="k">Inheritance model</span>
          {editing ? (
            <select
              value={variantCase.inheritanceModel}
              onChange={(e) =>
                setInheritanceModel(e.target.value as InheritanceModel)
              }
            >
              {INHERITANCE_MODELS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          ) : (
            <span className="v">{variantCase.inheritanceModel}</span>
          )}
        </div>
        <div>
          <span className="k">Current classification</span>
          <span className="v badge-vus">{variantCase.classification}</span>
        </div>
      </div>

      <div className="panel-block">
        <h3>HPO terms</h3>
        <ul className="hpo-list">
          {variantCase.patient.hpoTerms.map((t) => (
            <li key={t.id}>
              <span className="mono">{t.id}</span> {t.name}
            </li>
          ))}
        </ul>
      </div>

      <div className="panel-block">
        <h3>Family</h3>
        <p className="muted">{variantCase.family.summary}</p>
      </div>

      <div className="panel-block">
        <div className="block-head">
          <h3>Current evidence</h3>
          <button className="link-btn" onClick={() => setEditing((v) => !v)}>
            {editing ? "Done editing" : "Edit"}
          </button>
        </div>

        <ul className="evidence-list">
          {EDITABLE_CATEGORIES.map((key) => (
            <li key={key}>
              <span className="ev-label">
                {CATEGORY_LABELS[key]}
                {variantCase.evidence[key].source && (
                  <span className="live-badge" title={variantCase.evidence[key].detail}>
                    {variantCase.evidence[key].source}
                  </span>
                )}
              </span>
              {editing ? (
                <select
                  value={variantCase.evidence[key].status}
                  onChange={(e) =>
                    setEvidenceStatus(key, e.target.value as EvidenceStatus)
                  }
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              ) : (
                <StatusChip status={variantCase.evidence[key].status} />
              )}
            </li>
          ))}
        </ul>

        {editing && (
          <div className="family-flags">
            <span className="field-label">Family availability</span>
            <label>
              <input
                type="checkbox"
                checked={variantCase.family.historyPresent}
                onChange={(e) => setFamilyFlag("historyPresent", e.target.checked)}
              />
              Family history present
            </label>
            <label>
              <input
                type="checkbox"
                checked={variantCase.family.parentsAvailable}
                onChange={(e) => setFamilyFlag("parentsAvailable", e.target.checked)}
              />
              Parents available
            </label>
            <label>
              <input
                type="checkbox"
                checked={variantCase.family.affectedRelativesAvailable}
                onChange={(e) =>
                  setFamilyFlag("affectedRelativesAvailable", e.target.checked)
                }
              />
              Affected relatives available
            </label>
            <label>
              <input
                type="checkbox"
                checked={variantCase.family.unaffectedRelativesAvailable}
                onChange={(e) =>
                  setFamilyFlag("unaffectedRelativesAvailable", e.target.checked)
                }
              />
              Unaffected relatives available
            </label>
            <label>
              <input
                type="checkbox"
                checked={variantCase.family.consanguinity === true}
                onChange={(e) => setFamilyFlag("consanguinity", e.target.checked)}
              />
              Consanguinity
            </label>
            <label className="meioses-field">
              Informative meioses
              <input
                type="number"
                min={0}
                max={30}
                value={variantCase.family.informativeMeioses ?? ""}
                onChange={(e) =>
                  setInformativeMeioses(
                    e.target.value === "" ? undefined : Number(e.target.value)
                  )
                }
              />
            </label>
          </div>
        )}
      </div>

      <div className="panel-block">
        <h3>Tests performed</h3>
        <ul className="tests-list">
          {variantCase.testsPerformed.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
