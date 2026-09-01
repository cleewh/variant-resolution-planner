import { useState } from "react";
import type { RankedAction, ResolutionPlan } from "../engine/types";
import {
  ClinicalCaveat,
  DirectionChip,
  EffortBadge,
  LevelBadge,
  PriorityBadge,
  Section,
  StatusChip,
  StrengthChip,
} from "./ui";

function ScoreBreakdown({ action }: { action: RankedAction }) {
  const f = action.factors;
  return (
    <div className="score-breakdown">
      <p className="score-formula">
        Prototype prioritization score ={" "}
        <span className="mono">
          (Information value x Independence x Relevance x Feasibility) / Effort
        </span>
      </p>
      <table className="factor-table">
        <tbody>
          <tr>
            <td>Information value</td>
            <td className="mono">{f.informationValue}</td>
          </tr>
          <tr>
            <td>Independence</td>
            <td className="mono">{f.independence}</td>
          </tr>
          <tr>
            <td>Relevance</td>
            <td className="mono">{f.relevance}</td>
          </tr>
          <tr>
            <td>Feasibility</td>
            <td className="mono">{f.feasibility}</td>
          </tr>
          <tr>
            <td>Effort (divisor)</td>
            <td className="mono">{f.effort}</td>
          </tr>
          <tr className="score-total">
            <td>Score</td>
            <td className="mono">{action.score}</td>
          </tr>
        </tbody>
      </table>
      {action.evidenceBasis && (
        <p className="evidence-basis">
          <strong>Evidence basis:</strong> {action.evidenceBasis}
        </p>
      )}
      <p className="disclaimer-inline">
        This score is a transparent prioritization aid for the prototype. It is
        not a scientifically validated measure.
      </p>
    </div>
  );
}

function PhenotypeMatchCard({
  match,
}: {
  match: NonNullable<ResolutionPlan["phenotypeMatch"]>;
}) {
  const tone =
    match.level === "strong"
      ? "tone-good"
      : match.level === "partial"
      ? "tone-partial"
      : "tone-warn";
  const pct = Math.round(match.score * 100);
  return (
    <div className="phenotype-card">
      <div className="phenotype-head">
        <span className="phenotype-title">
          Phenotype fit (from HPO terms)
          <span className={`live-badge ${match.source === "live-hpo" ? "" : "tone-muted"}`}>
            {match.source === "live-hpo" ? "HPO live" : "synthetic map"}
          </span>
        </span>
        <span className={`chip strong ${tone}`}>
          {match.level} · {pct}%
        </span>
      </div>
      <p className="muted">{match.note}</p>
      <div className="phenotype-terms">
        {match.matched.length > 0 && (
          <div>
            <span className="drivers-title">Matched</span>
            <ul>
              {match.matched.map((t) => (
                <li key={t.id}>
                  <span className="mono">{t.id}</span> {t.name}
                </li>
              ))}
            </ul>
          </div>
        )}
        {match.expectedMissing.length > 0 && (
          <div>
            <span className="drivers-title">Expected but not observed</span>
            <ul>
              {match.expectedMissing.map((t) => (
                <li key={t.id}>
                  <span className="mono">{t.id}</span> {t.name}
                </li>
              ))}
            </ul>
          </div>
        )}
        {match.unexplained.length > 0 && (
          <div>
            <span className="drivers-title">Not explained by this gene</span>
            <ul>
              {match.unexplained.map((t) => (
                <li key={t.id}>
                  <span className="mono">{t.id}</span> {t.name}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <p className="disclaimer-inline">
        {match.source === "live-hpo"
          ? `Real HPO gene-phenotype associations (${match.expectedCount} terms). Exact-term overlap without the ontology graph, so related child terms may be undercounted — treat as a floor.`
          : "Synthetic, illustrative gene-phenotype map for the demo. A production system would compute semantic similarity against real HPO/OMIM annotations using the ontology graph."}
      </p>
    </div>
  );
}

function DriverList({ drivers }: { drivers: string[] }) {
  return (
    <div className="drivers">
      <span className="drivers-title">Driven by</span>
      <ul>
        {drivers.map((d, i) => (
          <li key={i}>{d}</li>
        ))}
      </ul>
    </div>
  );
}

function RankedActionCard({
  action,
  rank,
}: {
  action: RankedAction;
  rank: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="action-card">
      <div className="action-head">
        <div className="action-rank">#{rank}</div>
        <div className="action-title-wrap">
          <h3>{action.title}</h3>
          <div className="action-badges">
            <PriorityBadge priority={action.priority} />
            <span className="meta">
              Info value <LevelBadge level={action.informationValueLabel} />
            </span>
            <span className="meta">
              Effort <EffortBadge level={action.effortLabel} />
            </span>
            <span className="meta gap-meta">Gap: {action.gapAddressed}</span>
            <DirectionChip direction={action.direction} />
            {action.potentialStrength && (
              <span className="meta">
                Impact <StrengthChip strength={action.potentialStrength} />
              </span>
            )}
            {action.prerequisite && <span className="chip strong tone-warn">Prerequisite</span>}
          </div>
        </div>
      </div>

      {action.sequencingNote && (
        <p className="sequencing-note">↳ {action.sequencingNote}</p>
      )}

      <dl className="action-detail">
        <dt>Information gained</dt>
        <dd>{action.informationGained}</dd>
        <dt>Why it matters</dt>
        <dd>{action.whyItMatters}</dd>
        <dt>Potential evidence impact</dt>
        <dd>{action.potentialEvidenceImpact}</dd>
      </dl>

      {action.clinicalCaveat && <ClinicalCaveat text={action.clinicalCaveat} />}

      {action.suggestedIndividuals && action.suggestedIndividuals.length > 0 && (
        <div className="suggested">
          <span className="drivers-title">Suggested individuals</span>
          <ul>
            {action.suggestedIndividuals.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      <DriverList drivers={action.drivers} />

      <button className="link-btn" onClick={() => setOpen((v) => !v)}>
        {open ? "Hide score" : `Why it ranked here (score ${action.score})`}
      </button>
      {open && <ScoreBreakdown action={action} />}
    </div>
  );
}

export function PlanView({ plan }: { plan: ResolutionPlan }) {
  const rec = plan.recommended;

  return (
    <div className="plan">
      <div className="plan-title-row">
        <h1>Variant Resolution Plan</h1>
        <span className="source-badge">
          Narrative:{" "}
          {plan.narrativeSource === "bedrock"
            ? "Amazon Bedrock"
            : "local template"}
        </span>
      </div>

      {/* Status card */}
      <div className="status-card">
        <div>
          <span className="status-label">Current classification</span>
          <span className="status-value">{plan.classification}</span>
        </div>
        <p className="status-note">
          The classification is shown as provided. This tool does not reinterpret
          or change it.
        </p>
      </div>

      {/* Resolvability / expectation-setting */}
      <div className={`resolvability resolvability-${plan.resolvability.level}`}>
        <span className="resolvability-tag">
          Resolvability:{" "}
          {plan.resolvability.level === "likely"
            ? "Likely resolvable"
            : plan.resolvability.level === "constrained"
            ? "Possible but constrained"
            : "May remain a VUS"}
        </span>
        <p>{plan.resolvability.summary}</p>
      </div>

      {/* Phenotype fit (derived from HPO terms) */}
      {plan.phenotypeMatch && <PhenotypeMatchCard match={plan.phenotypeMatch} />}

      {/* Narrative */}
      <div className="narrative">{plan.narrative}</div>

      {/* Evidence snapshot */}
      <Section
        title="Current evidence snapshot"
        subtitle="What is known now, and where the gaps are."
      >
        <div className="snapshot-grid">
          <div className="snapshot-col">
            <h4>Strongest existing information</h4>
            {plan.strongestInformation.length === 0 ? (
              <p className="muted">None recorded.</p>
            ) : (
              <ul className="snap-list">
                {plan.strongestInformation.map((it) => (
                  <li key={it.key}>
                    <div className="snap-head">
                      <span>{it.label}</span>
                      <StatusChip status={it.status} />
                    </div>
                    <p className="muted">{it.detail}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="snapshot-col">
            <h4>Important evidence gaps</h4>
            {plan.evidenceGaps.length === 0 ? (
              <p className="muted">No open gaps in the tracked categories.</p>
            ) : (
              <ul className="snap-list">
                {plan.evidenceGaps.map((it) => (
                  <li key={it.key}>
                    <div className="snap-head">
                      <span>{it.label}</span>
                      <StatusChip status={it.status} />
                    </div>
                    <p className="muted">{it.detail}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {plan.contradictoryOrSaturated.length > 0 && (
            <div className="snapshot-col">
              <h4>Contradictory / already-saturated</h4>
              <ul className="snap-list">
                {plan.contradictoryOrSaturated.map((it) => (
                  <li key={it.key}>
                    <div className="snap-head">
                      <span>{it.label}</span>
                      <StatusChip status={it.status} />
                    </div>
                    <p className="muted">{it.detail}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Section>

      {/* Recommended next action — most prominent */}
      {rec && (
        <div className="recommended-card">
          <div className="rec-flag">Recommended next action</div>
          <h2>{rec.title}</h2>
          <div className="rec-badges">
            <span>
              Expected information value{" "}
              <LevelBadge level={rec.informationValueLabel} />
            </span>
            <span>
              Effort <EffortBadge level={rec.effortLabel} />
            </span>
            <span>
              Priority <PriorityBadge priority={rec.priority} />
            </span>
            <span>
              <DirectionChip direction={rec.direction} />
            </span>
            {rec.potentialStrength && (
              <span>
                <StrengthChip strength={rec.potentialStrength} />
              </span>
            )}
          </div>
          <p className="rec-why">{rec.whyItMatters}</p>
          <dl className="action-detail">
            <dt>Information gained</dt>
            <dd>{rec.informationGained}</dd>
            <dt>Potential evidence impact</dt>
            <dd>{rec.potentialEvidenceImpact}</dd>
          </dl>
          {rec.clinicalCaveat && <ClinicalCaveat text={rec.clinicalCaveat} />}
          {rec.suggestedIndividuals && rec.suggestedIndividuals.length > 0 && (
            <div className="suggested">
              <span className="drivers-title">Suggested individuals</span>
              <ul>
                {rec.suggestedIndividuals.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          <DriverList drivers={rec.drivers} />
        </div>
      )}

      {/* Ranked actions */}
      <Section
        title="Ranked evidence plan"
        subtitle="Ordered by PRIORITY (expected information gain per unit effort). 'Impact' is a separate axis: how decisively a result could move interpretation if obtained — a decisive test can be lower priority when it is costly."
      >
        {plan.sequencingNote && (
          <div className="sequencing-banner">{plan.sequencingNote}</div>
        )}
        <div className="action-list">
          {plan.rankedActions.map((a, i) => (
            <RankedActionCard key={a.id} action={a} rank={i + 1} />
          ))}
          {plan.rankedActions.length === 0 && (
            <p className="muted">No recommended actions for the current evidence.</p>
          )}
        </div>
        <p className="methodology-note">{plan.methodologyNote}</p>
      </Section>

      {/* Evidence value matrix */}
      <Section
        title="Evidence value matrix"
        subtitle="A compact view of every candidate investigation."
      >
        <table className="matrix">
          <thead>
            <tr>
              <th>Investigation</th>
              <th>Evidence gap addressed</th>
              <th>Information value</th>
              <th>Effort</th>
              <th>Priority</th>
            </tr>
          </thead>
          <tbody>
            {[...plan.rankedActions, ...plan.lowValueActions].map((a) => (
              <tr key={a.id} className={a.lowValue ? "row-lowvalue" : ""}>
                <td>{a.title}</td>
                <td>{a.gapAddressed}</td>
                <td>
                  <LevelBadge level={a.informationValueLabel} />
                </td>
                <td>
                  <EffortBadge level={a.effortLabel} />
                </td>
                <td>
                  <PriorityBadge priority={a.priority} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* Low-value actions — key differentiator */}
      <Section
        title="Low-value next actions"
        subtitle="Where the next unit of effort is unlikely to add independent information."
        id="low-value"
      >
        {plan.lowValueActions.length === 0 ? (
          <p className="muted">
            No candidate actions were flagged as low value for this case.
          </p>
        ) : (
          <div className="lowvalue-list">
            {plan.lowValueActions.map((a) => (
              <div key={a.id} className="lowvalue-card">
                <div className="lowvalue-head">
                  <h3>{a.title}</h3>
                  <PriorityBadge priority={a.priority} />
                </div>
                <p className="reason">
                  <strong>Reason:</strong>{" "}
                  {a.lowValueReason ?? a.potentialEvidenceImpact}
                </p>
                {a.clinicalCaveat && <ClinicalCaveat text={a.clinicalCaveat} />}
                <DriverList drivers={a.drivers} />
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Expert review */}
      <Section title="Expert review required">
        <div className="expert-review">
          <p>
            This plan is intended to help organise potential next steps for
            variant evidence gathering. Variant interpretation, ACMG/AMP evidence
            application, clinical testing decisions, and patient management
            require review by appropriately qualified professionals.
          </p>
          <p>
            This is a research and demonstration prototype. It does not diagnose,
            does not provide medical advice, does not independently classify
            variants, and does not implement the ACMG/AMP framework as a
            production clinical system. All data shown is synthetic.
          </p>
        </div>
      </Section>
    </div>
  );
}
