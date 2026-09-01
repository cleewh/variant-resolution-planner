import type { EvidencePreset } from "../data/cases";

export function AddEvidence({
  presets,
  onApply,
  appliedLog,
}: {
  presets: EvidencePreset[];
  onApply: (preset: EvidencePreset) => void;
  appliedLog: string[];
}) {
  return (
    <div className="add-evidence">
      <div className="ae-head">
        <h3>Add new evidence</h3>
        <p className="muted">
          Apply new evidence and regenerate the plan. Watch the priorities shift
          as the evidence picture changes.
        </p>
      </div>
      <div className="ae-buttons">
        {presets.map((p) => (
          <button
            key={p.id}
            className="ae-btn"
            title={p.description}
            onClick={() => onApply(p)}
          >
            {p.label}
          </button>
        ))}
      </div>
      {appliedLog.length > 0 && (
        <div className="ae-log">
          <span className="drivers-title">Evidence added this session</span>
          <ul>
            {appliedLog.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
