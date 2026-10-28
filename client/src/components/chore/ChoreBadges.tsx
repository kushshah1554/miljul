import type { ChoreAssignment, ChoreSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

const TONES = {
  neutral: "bg-background text-foreground/80",
  info: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  danger: "bg-destructive/10 text-destructive",
};

export function Pill({
  tone = "neutral",
  className,
  children,
}: {
  tone?: keyof typeof TONES;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const ASSIGNMENT_LABELS: Record<ChoreAssignment["status"], [string, keyof typeof TONES]> = {
  PENDING: ["To do", "neutral"],
  SUBMITTED: ["Awaiting review", "info"],
  APPROVED: ["Done", "success"],
  REJECTED: ["Rejected", "danger"],
  SKIPPED: ["Skipped", "neutral"],
  WAIVED: ["Waived", "neutral"],
};

/** Overdue is derived, not a status, so it takes precedence over "To do". */
export function AssignmentStatusBadge({ assignment }: { assignment: ChoreAssignment }) {
  if (assignment.isOverdue) return <Pill tone="danger">Overdue</Pill>;
  const [label, tone] = ASSIGNMENT_LABELS[assignment.status];
  return <Pill tone={tone}>{label}</Pill>;
}

export function ChoreStatusBadge({ chore }: { chore: ChoreSummary }) {
  if (chore.status === "ARCHIVED") return <Pill>Archived</Pill>;
  if (chore.status === "NEEDS_ATTENTION") return <Pill tone="danger">Needs attention</Pill>;
  if (chore.status === "PAUSED") return <Pill tone="info">Paused</Pill>;
  // ACTIVE but frozen by a group-wide pause
  if (chore.isFrozen) return <Pill tone="info">Frozen</Pill>;
  return null;
}
