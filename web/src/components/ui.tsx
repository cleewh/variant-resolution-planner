import type { ReactNode } from "react";
import type {
  EvidenceDirection,
  EvidenceStatus,
  LevelLabel,
  PotentialStrength,
  PriorityLabel,
} from "../engine/types";
import { STATUS_LABELS, STATUS_TONE } from "../engine/labels";

export function StrengthChip({ strength }: { strength: PotentialStrength }) {
  const tone =
    strength === "could be decisive"
      ? "tone-good"
      : strength === "moderate"
      ? "tone-partial"
      : strength === "supporting"
      ? "tone-neutral"
      : "tone-muted";
  return <span className={`chip ${tone}`} title="Coarse indication of how decisively a result could move interpretation">{strength}</span>;
}

const DIRECTION_LABELS: Record<EvidenceDirection, string> = {
  either: "May resolve either way",
  supporting: "Pathogenic-direction",
  refuting: "Benign-direction",
  neutral: "Prerequisite / neutral",
};

export function DirectionChip({ direction }: { direction: EvidenceDirection }) {
  const tone = direction === "neutral" ? "tone-muted" : "tone-neutral";
  return <span className={`chip ${tone}`}>{DIRECTION_LABELS[direction]}</span>;
}

export function ClinicalCaveat({ text }: { text: string }) {
  return (
    <div className="clinical-caveat">
      <span className="cc-tag">Clinical note</span>
      <span>{text}</span>
    </div>
  );
}

export function StatusChip({ status }: { status: EvidenceStatus }) {
  return (
    <span className={`chip ${STATUS_TONE[status]}`}>{STATUS_LABELS[status]}</span>
  );
}

export function LevelBadge({ level }: { level: LevelLabel }) {
  const tone =
    level === "High"
      ? "tone-good"
      : level === "Medium-High"
      ? "tone-good"
      : level === "Medium"
      ? "tone-partial"
      : "tone-neutral";
  return <span className={`chip ${tone}`}>{level}</span>;
}

export function PriorityBadge({ priority }: { priority: PriorityLabel }) {
  const tone =
    priority === "High"
      ? "tone-good"
      : priority === "Medium"
      ? "tone-partial"
      : priority === "Low"
      ? "tone-neutral"
      : "tone-muted";
  return <span className={`chip strong ${tone}`}>{priority}</span>;
}

export function EffortBadge({ level }: { level: LevelLabel }) {
  // For effort, "Low" is good (cheap), "High" is costly.
  const tone =
    level === "Low"
      ? "tone-good"
      : level === "Medium"
      ? "tone-partial"
      : "tone-warn";
  return <span className={`chip ${tone}`}>{level}</span>;
}

export function Section({
  title,
  subtitle,
  children,
  id,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section className="section" id={id}>
      <div className="section-head">
        <h2>{title}</h2>
        {subtitle && <p className="section-sub">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}
