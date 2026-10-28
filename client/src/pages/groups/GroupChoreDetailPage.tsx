import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  CalendarClock,
  ListChecks,
  Pause,
  Pencil,
  Play,
} from "lucide-react";

import { AssignmentRow } from "@/components/chore/AssignmentRow";
import { AssignmentSheet, type AssignmentRef } from "@/components/chore/AssignmentSheet";
import { AssignmentStatusBadge, ChoreStatusBadge } from "@/components/chore/ChoreBadges";
import { ChecklistSheet } from "@/components/chore/ChecklistSheet";
import { ChoreFormSheet } from "@/components/chore/ChoreFormSheet";
import { ChoreParticipantsCard } from "@/components/chore/ChoreParticipantsCard";
import { ChoreQueueCard } from "@/components/chore/ChoreQueueCard";
import { PauseHistory } from "@/components/chore/PauseHistory";
import { ReasonForm } from "@/components/chore/ReasonForm";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";

import { useAuthStore } from "@/features/auth/authStore";
import { useChoreAssignments } from "@/features/chore-assignment/useChoreAssignments";
import {
  useArchiveChore,
  useRestoreChore,
  useChore,
  usePauseChore,
  useResumeChore,
} from "@/features/chore/useChores";
import { useMembers } from "@/features/member/useMembers";
import { isOwner } from "@/lib/roles";
import { formatDateTime, formatDay, fromNow, minutesToTime } from "@/lib/time";
import type { ChoreAssignmentStatus, ChoreDetail, Group } from "@/lib/types";
import { useCurrentGroup } from "@/pages/groups/GroupLayout";

export default function GroupChoreDetailPage() {
  const group = useCurrentGroup();
  const { choreId = "" } = useParams();
  const { data: chore, isPending, isError, error } = useChore(group.id, choreId);

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        {/* path-relative: route-relative ".." would skip past /chores to the group overview */}
        <Link to=".." relative="path">
          <ArrowLeft /> All chores
        </Link>
      </Button>
      {isPending && <Skeleton className="h-40 w-full rounded-[1.75rem]" />}
      {isError && <p className="text-destructive">{error.message}</p>}
      {chore && <ChoreView group={group} chore={chore} />}
    </>
  );
}

type OwnerAction = "pause" | "archive" | null;

function ChoreView({ group, chore }: { group: Group; chore: ChoreDetail }) {
  const myUserId = useAuthStore((s) => s.user?.id ?? "");
  const { data: members = [] } = useMembers(group.id);
  const [viewing, setViewing] = useState<AssignmentRef | null>(null);
  const [editing, setEditing] = useState(false);
  const [editingChecklist, setEditingChecklist] = useState(false);
  const [ownerAction, setOwnerAction] = useState<OwnerAction>(null);
  const pause = usePauseChore(group.id, chore.id);
  const resume = useResumeChore(group.id, chore.id);
  const archive = useArchiveChore(group.id, chore.id);
  const restore = useRestoreChore(group.id, chore.id);

  const tz = group.timezone;
  const manage = isOwner(group.role) && !group.isArchived;
  const archived = chore.status === "ARCHIVED";
  const current = chore.currentAssignment;
  const open = (assignmentId: string) => setViewing({ choreId: chore.id, assignmentId });

  // Former members can still appear in queues and history
  const names = new Map<string, string>([
    ...members.map((m) => [m.userId, m.user.name] as const),
    ...chore.participants.map((p) => [p.userId, p.user.name] as const),
  ]);
  const nameOf = (id: string) => (id === myUserId ? "You" : (names.get(id) ?? "Former member"));
  const pastOpen = chore.openAssignments.filter((a) => a.id !== current?.id);

  return (
    <>
      <section className="surface surface-glow space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-bold tracking-tight">{chore.name}</h2>
              <ChoreStatusBadge chore={chore} />
            </div>
            {chore.description && <p className="text-muted-foreground">{chore.description}</p>}
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              <CalendarClock className="size-4" /> Every {chore.intervalDays} day
              {chore.intervalDays === 1 ? "" : "s"} · due {minutesToTime(chore.deadlineMinutes)} the
              next day · fine {chore.finePerMember} per member
            </p>
          </div>
          {manage && !archived && ownerAction === null && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                <Pencil /> Edit
              </Button>
              {chore.status === "PAUSED" ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={resume.isPending}
                  onClick={() => resume.mutate(undefined)}
                >
                  <Play /> {resume.isPending ? "Resuming…" : "Resume"}
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setOwnerAction("pause")}>
                  <Pause /> Pause
                </Button>
              )}
              <Button size="sm" variant="destructive" onClick={() => setOwnerAction("archive")}>
                <Archive /> Archive
              </Button>
            </div>
          )}
          {manage && archived && (
            <Button
              size="sm"
              variant="outline"
              disabled={restore.isPending}
              onClick={() => restore.mutate(undefined)}
            >
              <ArchiveRestore /> {restore.isPending ? "Restoring…" : "Restore"}
            </Button>
          )}
        </div>

        {ownerAction === "pause" && (
          <ReasonForm
            required={false}
            placeholder="Away for the week…"
            submitLabel="Pause chore"
            isPending={pause.isPending}
            onSubmit={(reason) => pause.mutate(reason, { onSuccess: () => setOwnerAction(null) })}
            onCancel={() => setOwnerAction(null)}
          />
        )}
        {ownerAction === "archive" && (
          <ReasonForm
            required={false}
            destructive
            placeholder="We bought a dishwasher…"
            submitLabel="Archive chore"
            isPending={archive.isPending}
            onSubmit={(reason) => archive.mutate(reason, { onSuccess: () => setOwnerAction(null) })}
            onCancel={() => setOwnerAction(null)}
          >
            <p className="text-xs text-muted-foreground">
              The rotation stops until restored. Open turns can still be submitted and reviewed; fines are kept.
            </p>
          </ReasonForm>
        )}

        {chore.isFrozen && !archived && (
          <p className="rounded-2xl bg-background/70 px-3 py-2.5 text-sm text-muted-foreground">
            {chore.status === "PAUSED" ? "This chore is paused." : "All chores are paused."} The clock
            is frozen: deadlines move forward by the paused time when it resumes.
          </p>
        )}
        {chore.status === "NEEDS_ATTENTION" && (
          <p className="rounded-2xl bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
            Nobody is available for the next turn. Add a participant or mark someone available to
            restart the rotation.
          </p>
        )}

        {current && (
          <button
            type="button"
            onClick={() => open(current.id)}
            className="flex w-full items-center gap-3 rounded-2xl bg-background/70 px-4 py-3 text-left transition-colors hover:bg-background"
          >
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Current turn</p>
              <p className="truncate text-lg font-semibold">{nameOf(current.userId)}</p>
              <p className="truncate text-sm text-muted-foreground">
                Due {formatDateTime(current.deadlineAt, tz)} ({fromNow(current.deadlineAt)})
                {current.skipRequestedAt && " · asked to skip"}
              </p>
            </div>
            <AssignmentStatusBadge assignment={current} />
          </button>
        )}
      </section>

      {pastOpen.length > 0 && (
        <section className="surface space-y-3">
          <h2 className="text-lg font-semibold">Still open</h2>
          <p className="text-xs text-muted-foreground">
            Earlier turns not yet done or reviewed. Late work can still be submitted.
          </p>
          <ul className="space-y-1">
            {pastOpen.map((a) => (
              <AssignmentRow key={a.id} assignment={a} timeZone={tz} onSelect={() => open(a.id)} />
            ))}
          </ul>
        </section>
      )}

      {!archived && (
        <section className="surface space-y-3">
          <h2 className="text-lg font-semibold">Coming up</h2>
          {chore.upcoming.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {chore.isFrozen ? "Paused — nothing is scheduled." : "Nobody is scheduled."}
            </p>
          )}
          <ol className="space-y-1">
            {chore.upcoming.map((turn) => (
              <li
                key={`${turn.userId}-${turn.startsAt}`}
                className="flex items-center gap-3 rounded-2xl px-3 py-2 text-sm hover:bg-background/60"
              >
                <span className="w-24 shrink-0 text-muted-foreground">{formatDay(turn.startsAt, tz)}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{nameOf(turn.userId)}</span>
                <span className="shrink-0 text-xs text-muted-foreground">cycle {turn.cycleNumber}</span>
              </li>
            ))}
          </ol>
          <p className="text-xs text-muted-foreground">
            Projected — skips people marked away and may change.
          </p>
        </section>
      )}

      {!archived && (
        <ChoreQueueCard
          groupId={group.id}
          chore={chore}
          names={names}
          canManage={manage}
          timeZone={tz}
        />
      )}

      <ChoreParticipantsCard
        groupId={group.id}
        chore={chore}
        members={members}
        canManage={manage}
        timeZone={tz}
      />

      <section className="surface space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Checklist</h2>
          {manage && !archived && (
            <Button size="sm" variant="outline" onClick={() => setEditingChecklist(true)}>
              <Pencil /> Edit
            </Button>
          )}
        </div>
        {chore.checklist.length === 0 && (
          <p className="text-sm text-muted-foreground">No checklist items.</p>
        )}
        <ul className="space-y-1">
          {chore.checklist.map((item) => (
            <li key={item.id} className="flex items-center gap-3 rounded-2xl px-3 py-2 text-sm">
              <ListChecks className="size-4 shrink-0 text-muted-foreground" />
              {item.label}
            </li>
          ))}
        </ul>
      </section>

      <HistoryCard group={group} chore={chore} nameOf={nameOf} onSelect={open} />
      <PauseHistory groupId={group.id} choreId={chore.id} timeZone={tz} />

      <ChoreFormSheet groupId={group.id} open={editing} onOpenChange={setEditing} chore={chore} />
      <ChecklistSheet
        groupId={group.id}
        choreId={chore.id}
        checklist={chore.checklist}
        open={editingChecklist}
        onOpenChange={setEditingChecklist}
      />
      <AssignmentSheet group={group} target={viewing} onClose={() => setViewing(null)} />
    </>
  );
}

const PAGE_SIZE = 8;
const FILTERS: Array<{ label: string; status?: ChoreAssignmentStatus; overdue?: true }> = [
  { label: "All" },
  { label: "Overdue", overdue: true },
  { label: "Done", status: "APPROVED" },
  { label: "Rejected", status: "REJECTED" },
  { label: "Skipped", status: "SKIPPED" },
];

function HistoryCard({
  group,
  chore,
  nameOf,
  onSelect,
}: {
  group: Group;
  chore: ChoreDetail;
  nameOf: (userId: string) => string;
  onSelect: (assignmentId: string) => void;
}) {
  const [filter, setFilter] = useState(0);
  const [page, setPage] = useState(1);
  const { status, overdue } = FILTERS[filter];
  const { data, isPending, isError, error, isPlaceholderData } = useChoreAssignments(
    group.id,
    chore.id,
    { status, overdue: overdue ? "true" : undefined, page, limit: PAGE_SIZE },
  );

  return (
    <section className="surface space-y-3">
      <h2 className="text-lg font-semibold">History</h2>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f, i) => (
          <Button
            key={f.label}
            size="sm"
            variant={filter === i ? "default" : "outline"}
            onClick={() => {
              setFilter(i);
              setPage(1);
            }}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {isPending && <Skeleton className="h-24 w-full" />}
      {isError && <p className="text-sm text-destructive">{error.message}</p>}
      {data?.assignments.length === 0 && (
        <p className="text-sm text-muted-foreground">No turns match.</p>
      )}
      <ul className="space-y-1">
        {data?.assignments.map((a) => (
          <AssignmentRow
            key={a.id}
            assignment={a}
            title={nameOf(a.userId)}
            timeZone={group.timezone}
            onSelect={() => onSelect(a.id)}
          />
        ))}
      </ul>
      {data && data.meta.totalPages > 1 && (
        <Pagination
          page={data.meta.page}
          totalPages={data.meta.totalPages}
          total={data.meta.total}
          limit={data.meta.limit}
          onPageChange={setPage}
          disabled={isPlaceholderData}
        />
      )}
    </section>
  );
}
