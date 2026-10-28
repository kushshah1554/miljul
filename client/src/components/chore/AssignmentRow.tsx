import { ClipboardCheck } from "lucide-react";

import { AssignmentStatusBadge } from "@/components/chore/ChoreBadges";
import { formatDateTime, formatDay } from "@/lib/time";
import type { ChoreAssignment } from "@/lib/types";

/** One assignment in a list; `title` defaults to the assignee's name. */
export function AssignmentRow({
  assignment,
  title,
  timeZone,
  onSelect,
}: {
  assignment: ChoreAssignment;
  title?: string;
  timeZone: string;
  onSelect: (assignment: ChoreAssignment) => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(assignment)}
        className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-background/70"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-background">
          <ClipboardCheck className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{title ?? assignment.user.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {formatDay(assignment.startsAt, timeZone)} · due{" "}
            {formatDateTime(assignment.deadlineAt, timeZone)}
          </p>
        </div>
        <AssignmentStatusBadge assignment={assignment} />
      </button>
    </li>
  );
}
