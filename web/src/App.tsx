import { useCallback, useMemo, useState } from "react";
import type { ResolutionPlan, VariantCase } from "./engine/types";
import { buildResolutionPlan } from "./engine/planner";
import { bedrockConfiguredHint, enhanceNarrative } from "./api/explain";
import { applyAnnotation, caseSupportsLiveLookup, fetchAnnotation } from "./api/annotate";
import {
  DEMO_CASES,
  EVIDENCE_PRESETS,
  cardiomyopathyCase,
} from "./data/cases";
import type { EvidencePreset } from "./data/cases";
import { CasePanel } from "./components/CasePanel";
import { PlanView } from "./components/PlanView";
import { AddEvidence } from "./components/AddEvidence";

function findCase(id: string): VariantCase {
  return DEMO_CASES.find((c) => c.id === id) ?? cardiomyopathyCase;
}

export function App() {
  const [variantCase, setVariantCase] = useState<VariantCase>(cardiomyopathyCase);
  const [plan, setPlan] = useState<ResolutionPlan | null>(null);
  const [appliedLog, setAppliedLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [bedrockNote, setBedrockNote] = useState<string | null>(null);
  const [bedrockActive, setBedrockActive] = useState(false);
  const [annotating, setAnnotating] = useState(false);
  const [annotationNote, setAnnotationNote] = useState<string | null>(null);

  const hint = useMemo(() => bedrockConfiguredHint(), []);

  const generate = useCallback(async (c: VariantCase) => {
    setBusy(true);
    setBedrockNote(null);
    const localPlan = buildResolutionPlan(c);
    // Show the deterministic plan immediately, then enhance if a backend exists.
    setPlan(localPlan);

    const result = await enhanceNarrative(c, localPlan);
    setPlan(result.plan);
    if (result.usedBedrock) {
      setBedrockActive(true);
      setBedrockNote("Narrative enhanced with Amazon Bedrock.");
    } else if (result.error) {
      setBedrockNote(
        `Bedrock enhancement unavailable (${result.error}); showing local narrative.`
      );
    }
    setBusy(false);
  }, []);

  const handleLoadDemo = useCallback((id: string) => {
    const c = findCase(id);
    setVariantCase(c);
    setPlan(null);
    setAppliedLog([]);
  }, []);

  const handleCaseChange = useCallback((next: VariantCase) => {
    setVariantCase(next);
  }, []);

  const handleFetchAnnotation = useCallback(async () => {
    setAnnotating(true);
    setAnnotationNote(null);
    const result = await fetchAnnotation(variantCase);
    if (result.annotation) {
      const ann = result.annotation;
      const next = applyAnnotation(variantCase, ann);
      setVariantCase(next);
      const parts = ann.sources.length ? `sources: ${ann.sources.join(", ")}` : "no sources";
      const errs = ann.errors.length ? ` (issues: ${ann.errors.join("; ")})` : "";
      setAnnotationNote(`Live annotations applied — ${parts}${errs}.`);
      void generate(next);
    } else {
      setAnnotationNote(result.error ?? "Live annotation failed.");
    }
    setAnnotating(false);
  }, [variantCase, generate]);

  const handleApplyPreset = useCallback(
    (preset: EvidencePreset) => {
      const next = preset.apply(variantCase);
      setVariantCase(next);
      setAppliedLog((log) => [...log, preset.label]);
      // Regenerate immediately so the "plan changes as evidence changes" story lands.
      void generate(next);
    },
    [variantCase, generate]
  );

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <div>
            <h1 className="brand">Variant Resolution Planner</h1>
            <p className="tagline">From uncertain variant to evidence plan</p>
          </div>
          <div className="header-actions">
            <span
              className={`backend-pill ${bedrockActive || hint ? "on" : "off"}`}
              title={
                bedrockActive
                  ? "Narrative is being enhanced by Amazon Bedrock."
                  : hint
                  ? "A Bedrock backend is configured (VITE_API_URL)."
                  : "Running fully local with deterministic reasoning. A Bedrock backend can be configured."
              }
            >
              {bedrockActive
                ? "Bedrock: active"
                : hint
                ? "Bedrock: configured"
                : "Local mode"}
            </span>
          </div>
        </div>
        <div className="research-banner">
          Research / demonstration prototype. Synthetic data only. Not a clinical
          diagnostic system. Does not classify variants.
        </div>
      </header>

      <div className="layout">
        <CasePanel
          variantCase={variantCase}
          onChange={handleCaseChange}
          onLoadDemo={handleLoadDemo}
          onFetchAnnotation={handleFetchAnnotation}
          annotating={annotating}
          canFetchAnnotation={caseSupportsLiveLookup(variantCase)}
          annotationNote={annotationNote}
        />

        <main className="main">
          <div className="toolbar">
            <button
              className="primary-btn"
              onClick={() => void generate(variantCase)}
              disabled={busy}
            >
              {busy ? "Generating…" : "Generate Resolution Plan"}
            </button>
            <button
              className="secondary-btn"
              onClick={() => handleLoadDemo(cardiomyopathyCase.id)}
            >
              Load Demo Case
            </button>
            {bedrockNote && <span className="bedrock-note">{bedrockNote}</span>}
          </div>

          <AddEvidence
            presets={EVIDENCE_PRESETS}
            onApply={handleApplyPreset}
            appliedLog={appliedLog}
          />

          {plan ? (
            <PlanView plan={plan} />
          ) : (
            <div className="empty-state">
              <h2>No plan generated yet</h2>
              <p>
                A synthetic demo case is loaded on the left. Click{" "}
                <strong>Generate Resolution Plan</strong> to see what evidence
                would most efficiently reduce the uncertainty around this variant.
              </p>
              <p className="muted">
                Then try <strong>Add new evidence</strong> to watch the plan
                re-prioritise as the evidence picture changes.
              </p>
            </div>
          )}
        </main>
      </div>

      <footer className="app-footer">
        <span>
          Variant Resolution Planner — a research prototype exploring
          evidence-gap planning for variants of uncertain significance.
        </span>
      </footer>
    </div>
  );
}
