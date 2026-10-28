import { useState } from "react";
import { Link } from "react-router-dom";
import { ListChecks, Pause, Play, Plus } from "lucide-react";

import { AssignmentRow } from "@/components/chore/AssignmentRow";
import { AssignmentSheet, type AssignmentRef } from "@/components/chore/AssignmentSheet";
import { ChoreStatusBadge } from "@/components/chore/ChoreBadges";
import { ChoreFormSheet } from "@/components/chore/ChoreFormSheet";
import { PauseHistory } from "@/components/chore/PauseHistory";
import { ReasonForm } from "@/components/chore/ReasonForm";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { useMyAssignments } from "@/features/chore-assignment/useChoreAssignments";
import { useChores, usePauseAllChores, useResumeAllChores } from "@/features/chore/useChores";
import { useAuthStore } from "@/features/auth/authStore";
import { isOwner } from "@/lib/roles";
import { formatDateTime, fromNow } from "@/lib/time";
import type { ChoreSummary } from "@/lib/types";
import { useCurrentGroup } from "@/pages/groups/GroupLayout";

type Tab = "active" | "archived";

export default function GroupChoresPage() {
  const group = useCurrentGroup();
  const [tab, setTab] = useState<Tab>("active");
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<AssignmentRef | null>(null);
  const [pauseOpen, setPauseOpen] = useState(false);

  const chores = useChores(group.id, tab === "archived" ? "ARCHIVED" : undefined);
  const mine = useMyAssignments(group.id, { open: "true", limit: 5 });
  const pauseAll = usePauseAllChores(group.id);
  const resumeAll = useResumeAllChores(group.id);

  const manage = isOwner(group.role) && !group.isArchived;
  const groupPausedAt = chores.data?.groupPausedAt ?? group.choresPausedAt;
  const choreNames = new Map(chores.data?.chores.map((c) => [c.id, c.name]));
  const tz = group.timezone;

  return (
    <>
      <section className="surface surface-glow space-y-3">
        <h2 className="text-lg font-semibold">Your chores</h2>
        {mine.isPending && <Skeleton className="h-12 w-full" />}
        {mine.isError && <p className="text-sm text-destructive">{mine.error.message}</p>}
        {mine.data?.assignments.length === 0 && (
          <p className="text-sm text-muted-foreground">Nothing to do right now.</p>
        )}
        <ul className="space-y-1">
          {mine.data?.assignments.map((a) => (
            <AssignmentRow
              key={a.id}
              assignment={a}
              title={a.choreName}
              timeZone={tz}
              onSelect={() => setViewing({ choreId: a.choreId, assignmentId: a.id })}
            />
          ))}
        </ul>
      </section>

      <section className="surface space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Chores</h2>
          {manage && (
            <div className="flex gap-2">
              {groupPausedAt ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={resumeAll.isPending}
                  onClick={() => resumeAll.mutate(undefined)}
                >
                  <Play /> {resumeAll.isPending ? "Resuming…" : "Resume all"}
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setPauseOpen(true)}>
                  <Pause /> Pause all
                </Button>
              )}
              <Button size="sm" onClick={() => setCreating(true)}>
                <Plus /> New chore
              </Button>
            </div>
          )}
        </div>

        {pauseOpen && (
          <ReasonForm
            required={false}
            placeholder="Holiday, everyone away…"
            submitLabel="Pause all chores"
            isPending={pauseAll.isPending}
            onSubmit={(reason) => pauseAll.mutate(reason, { onSuccess: () => setPauseOpen(false) })}
            onCancel={() => setPauseOpen(false)}
          />
        )}

        {groupPausedAt && (
          <p className="rounded-2xl bg-background px-3 py-2.5 text-sm text-muted-foreground">
            All chores are paused since {formatDateTime(groupPausedAt, tz)}. Deadlines move forward
            by the paused time when they resume.
          </p>
        )}

        <div className="flex gap-2">
          {(["active", "archived"] as const).map((t) => (
            <Button
              key={t}
              size="sm"
              variant={tab === t ? "default" : "outline"}
              onClick={() => setTab(t)}
            >
              {t === "active" ? "Current" : "Archived"}
            </Button>
          ))}
        </div>

        {chores.isPending && (
          <div className="space-y-2">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        )}
        {chores.isError && <p className="text-sm text-destructive">{chores.error.message}</p>}
        {chores.data?.chores.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {tab === "archived" ? "No archived chores." : "No chores yet."}
          </p>
        )}

        <ul className="space-y-1">
          {chores.data?.chores.map((chore) => (
            <ChoreRow key={chore.id} chore={chore} timeZone={tz} />
          ))}
        </ul>
      </section>

      <PauseHistory groupId={group.id} timeZone={tz} choreNames={choreNames} />

      <ChoreFormSheet groupId={group.id} open={creating} onOpenChange={setCreating} />
      <AssignmentSheet group={group} target={viewing} onClose={() => setViewing(null)} />
    </>
  );
}

function ChoreRow({ chore, timeZone }: { chore: ChoreSummary; timeZone: string }) {
  const myUserId = useAuthStore((s) => s.user?.id ?? "");
  const current = chore.currentAssignment;

  return (
    <li>
      <Link
        to={chore.id}
        className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-background/70"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-background">
          <ListChecks className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{chore.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {current
              ? `${current.userId === myUserId ? "Your turn" : current.user.name} · due ${formatDateTime(current.deadlineAt, timeZone)}`
              : chore.status === "NEEDS_ATTENTION"
                ? "Nobody is available for the next turn"
                : `Every ${chore.intervalDays} day${chore.intervalDays === 1 ? "" : "s"}`}
            {chore.nextRotationAt && ` · rotates ${fromNow(chore.nextRotationAt)}`}
          </p>
        </div>
        <ChoreStatusBadge chore={chore} />
      </Link>
    </li>
  );
}
