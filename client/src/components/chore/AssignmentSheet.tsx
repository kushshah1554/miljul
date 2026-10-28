import { useState } from "react";
import { Ban, CircleCheck, CircleX, Hand, Send, SkipForward } from "lucide-react";

import { AssignmentStatusBadge, Pill } from "@/components/chore/ChoreBadges";
import { ReasonForm } from "@/components/chore/ReasonForm";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import { useAuthStore } from "@/features/auth/authStore";
import type { AssignmentDetailPayload } from "@/features/chore-assignment/chore-assignment.api";
import {
  useAssignment,
  useRequestSkip,
  useReviewAssignment,
  useSkipAssignment,
  useSubmitAssignment,
  useWaiveAssignment,
} from "@/features/chore-assignment/useChoreAssignments";
import { useChore } from "@/features/chore/useChores";
import { useMembers } from "@/features/member/useMembers";
import { canReviewChore, isOwner } from "@/lib/roles";
import { formatDateTime, fromNow, localInputToIso } from "@/lib/time";
import type { ChoreChecklistItem, ChoreReviewDecision, ChoreSkipMode, Group } from "@/lib/types";

export type AssignmentRef = { choreId: string; assignmentId: string };

/** Everything about one turn: status, reviews, fine, and the actions the caller may take. */
export function AssignmentSheet({
  group,
  target,
  onClose,
}: {
  group: Group;
  target: AssignmentRef | null;
  onClose: () => void;
}) {
  return (
    <Sheet open={!!target} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="overflow-y-auto">
        {target && <AssignmentBody key={target.assignmentId} group={group} target={target} />}
      </SheetContent>
    </Sheet>
  );
}

type Action = "submit" | "skipRequest" | "skip" | "waive" | null;

function AssignmentBody({ group, target }: { group: Group; target: AssignmentRef }) {
  const myUserId = useAuthStore((s) => s.user?.id ?? "");
  const { data, isPending, isError, error } = useAssignment(group.id, target.choreId, target.assignmentId);
  const { data: chore } = useChore(group.id, target.choreId);
  const { data: members } = useMembers(group.id);
  const [action, setAction] = useState<Action>(null);

  const tz = group.timezone;
  const a = data?.assignment;
  const ownerId = members?.find((m) => m.role === "OWNER")?.userId;
  const writable = !group.isArchived;
  const isMine = a?.userId === myUserId;
  const isCurrent = !!a && chore?.currentAssignment?.id === a.id;
  const owner = isOwner(group.role);

  const can = a && {
    submit: writable && isMine && a.status === "PENDING",
    skipRequest: writable && isMine && isCurrent && a.status === "PENDING" && !a.skipRequestedAt,
    skip: writable && owner && isCurrent && a.status === "PENDING" && !chore?.isFrozen,
    waive: writable && owner && (a.status === "PENDING" || a.status === "SUBMITTED"),
    review:
      writable &&
      ["SUBMITTED", "APPROVED", "REJECTED"].includes(a.status) &&
      canReviewChore(group.role, myUserId, a.userId, ownerId),
  };

  return (
    <>
      <SheetHeader>
        <SheetTitle className="pr-8">
          {a ? `${isMine ? "Your" : `${a.user.name}'s`} turn` : "Assignment"}
          {chore && <span className="text-muted-foreground"> · {chore.name}</span>}
        </SheetTitle>
        <SheetDescription>
          {a
            ? `${formatDateTime(a.startsAt, tz)} → ${formatDateTime(a.endsAt, tz)}`
            : "Loading…"}
        </SheetDescription>
      </SheetHeader>

      <div className="space-y-4 px-4 pb-4">
        {isPending && <Skeleton className="h-32 w-full" />}
        {isError && <p className="text-sm text-destructive">{error.message}</p>}

        {data && a && can && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <AssignmentStatusBadge assignment={a} />
              {isCurrent && <Pill tone="info">Current turn</Pill>}
              {a.wasLate && a.firstSubmittedAt && <Pill tone="danger">Submitted late</Pill>}
            </div>

            <dl className="space-y-1 rounded-2xl bg-card p-1.5 text-sm">
              <Detail term="Due">
                {formatDateTime(a.deadlineAt, tz)}
                {a.status === "PENDING" && (
                  <span className="text-muted-foreground"> ({fromNow(a.deadlineAt)})</span>
                )}
              </Detail>
              {a.submittedAt && <Detail term="Submitted">{formatDateTime(a.submittedAt, tz)}</Detail>}
              {a.submissionNote && <Detail term="Note">{a.submissionNote}</Detail>}
              {a.skipRequestedAt && (
                <Detail term="Skip requested">{a.skipRequestReason ?? "—"}</Detail>
              )}
              {a.closedBy && (
                <Detail term={a.status === "SKIPPED" ? "Skipped by" : "Waived by"}>
                  {a.closedBy.name}
                  {a.skipMode && ` · ${a.skipMode === "DEFER" ? "turn deferred" : "turn forfeited"}`}
                  {a.closeReason && <span className="block text-muted-foreground">{a.closeReason}</span>}
                </Detail>
              )}
            </dl>

            <FineBlock fine={data.fine} />
            <Reviews reviews={data.reviews} timeZone={tz} />

            {can.review && (
              <ReviewForm
                groupId={group.id}
                target={target}
                status={a.status}
                checklist={data.checklist}
              />
            )}

            {(can.submit || can.skipRequest || can.skip || can.waive) && action === null && (
              <div className="flex flex-wrap gap-2">
                {can.submit && (
                  <Button size="sm" onClick={() => setAction("submit")}>
                    <Send /> Mark as done
                  </Button>
                )}
                {can.skipRequest && (
                  <Button size="sm" variant="outline" onClick={() => setAction("skipRequest")}>
                    <Hand /> Ask to skip
                  </Button>
                )}
                {can.skip && (
                  <Button size="sm" variant="outline" onClick={() => setAction("skip")}>
                    <SkipForward /> Skip turn
                  </Button>
                )}
                {can.waive && (
                  <Button size="sm" variant="outline" onClick={() => setAction("waive")}>
                    <Ban /> Waive
                  </Button>
                )}
              </div>
            )}

            <ActionForm
              action={action}
              groupId={group.id}
              target={target}
              onDone={() => setAction(null)}
            />
          </>
        )}
      </div>
    </>
  );
}

function Detail({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl bg-background px-3 py-2.5">
      <dt className="w-28 shrink-0 text-muted-foreground">{term}</dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  );
}

function FineBlock({ fine }: { fine: AssignmentDetailPayload["fine"] }) {
  if (!fine) return null;
  return (
    <div className="space-y-1 rounded-2xl bg-card p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">Fine</span>
        <Pill tone={fine.status === "ACTIVE" ? "danger" : "neutral"}>
          {fine.status === "ACTIVE" ? fine.reasons.join(" + ").toLowerCase() : "voided"}
        </Pill>
      </div>
      <p className={fine.status === "ACTIVE" ? "font-mono text-xl font-bold" : "font-mono text-xl font-bold line-through opacity-60"}>
        {fine.totalAmount}
      </p>
      <p className="text-xs text-muted-foreground">
        {fine.shares.length} member{fine.shares.length === 1 ? "" : "s"} receive{" "}
        {fine.shares[0]?.amount ?? "0.00"} each
        {fine.voidReason && ` · voided: ${fine.voidReason}`}
      </p>
    </div>
  );
}

function Reviews({ reviews, timeZone }: { reviews: AssignmentDetailPayload["reviews"]; timeZone: string }) {
  if (reviews.length === 0) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">Reviews</h3>
      <ul className="space-y-2">
        {reviews.map((r) => (
          <li key={r.id} className="space-y-1.5 rounded-2xl bg-card p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{r.reviewer.name}</span>
              <Pill tone={r.decision === "APPROVED" ? "success" : "danger"}>
                {r.decision === "APPROVED" ? "Approved" : "Rejected"}
              </Pill>
            </div>
            <p className="text-xs text-muted-foreground">{formatDateTime(r.createdAt, timeZone)}</p>
            {r.feedback && <p>{r.feedback}</p>}
            {r.results.length > 0 && (
              <ul className="space-y-0.5">
                {r.results.map((item) => (
                  <li key={item.itemId} className="flex items-center gap-2 text-xs">
                    {item.passed ? (
                      <CircleCheck className="size-3.5 text-success" />
                    ) : (
                      <CircleX className="size-3.5 text-destructive" />
                    )}
                    {item.label}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** First review or re-review; a re-review can only flip the decision. */
function ReviewForm({
  groupId,
  target,
  status,
  checklist,
}: {
  groupId: string;
  target: AssignmentRef;
  status: string;
  checklist: ChoreChecklistItem[];
}) {
  const review = useReviewAssignment(groupId);
  const [passed, setPassed] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(checklist.map((i) => [i.id, true])),
  );
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (decision: ChoreReviewDecision) => {
    const text = feedback.trim();
    if (decision === "REJECTED" && !text) return setError("Say what needs fixing");
    if (text.length > 1000) return setError("At most 1000 characters");
    review.mutate({
      ...target,
      decision,
      feedback: text || undefined,
      results: checklist.map((i) => ({ itemId: i.id, passed: passed[i.id] ?? false })),
    });
  };

  return (
    <div className="space-y-3 rounded-2xl bg-card p-3">
      <h3 className="text-sm font-medium">{status === "SUBMITTED" ? "Review" : "Change review"}</h3>
      {checklist.length > 0 && (
        <ul className="space-y-2">
          {checklist.map((item) => (
            <li key={item.id} className="flex items-center gap-3">
              <Checkbox
                id={`review-${item.id}`}
                checked={passed[item.id]}
                onCheckedChange={(c) => setPassed((p) => ({ ...p, [item.id]: c === true }))}
              />
              <Label htmlFor={`review-${item.id}`} className="font-normal">
                {item.label}
              </Label>
            </li>
          ))}
        </ul>
      )}
      <div className="space-y-2">
        <Label htmlFor="review-feedback">Feedback</Label>
        <Input
          id="review-feedback"
          placeholder="Required when rejecting"
          value={feedback}
          aria-invalid={!!error}
          onChange={(e) => {
            setFeedback(e.target.value);
            setError(null);
          }}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      <div className="flex gap-2">
        {status !== "APPROVED" && (
          <Button size="sm" onClick={() => submit("APPROVED")} disabled={review.isPending}>
            <CircleCheck /> Approve
          </Button>
        )}
        {status !== "REJECTED" && (
          <Button
            size="sm"
            variant="destructive"
            onClick={() => submit("REJECTED")}
            disabled={review.isPending}
          >
            <CircleX /> Reject
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Rejecting adds a quality fine; approving on a re-review removes it.
      </p>
    </div>
  );
}

function ActionForm({
  action,
  groupId,
  target,
  onDone,
}: {
  action: Action;
  groupId: string;
  target: AssignmentRef;
  onDone: () => void;
}) {
  const submit = useSubmitAssignment(groupId);
  const skipRequest = useRequestSkip(groupId);
  const skip = useSkipAssignment(groupId);
  const waive = useWaiveAssignment(groupId);
  const [mode, setMode] = useState<ChoreSkipMode>("DEFER");
  const [awayUntil, setAwayUntil] = useState("");
  const done = { onSuccess: onDone };

  switch (action) {
    case "submit":
      return (
        <ReasonForm
          label="Note"
          required={false}
          maxLength={500}
          placeholder="Anything the reviewer should know"
          submitLabel="Submit for review"
          isPending={submit.isPending}
          onSubmit={(note) => submit.mutate({ ...target, note }, done)}
          onCancel={onDone}
        />
      );
    case "skipRequest":
      return (
        <ReasonForm
          placeholder="Sick, away…"
          submitLabel="Ask the owner"
          isPending={skipRequest.isPending}
          onSubmit={(reason) => skipRequest.mutate({ ...target, reason: reason ?? "" }, done)}
          onCancel={onDone}
        />
      );
    case "skip":
      return (
        <ReasonForm
          placeholder="Sick, away…"
          submitLabel="Skip turn"
          isPending={skip.isPending}
          onSubmit={(reason) =>
            skip.mutate(
              {
                ...target,
                reason: reason ?? "",
                mode,
                unavailableUntil: awayUntil ? localInputToIso(awayUntil) : undefined,
              },
              done,
            )
          }
          onCancel={onDone}
        >
          <div className="space-y-2">
            <Label htmlFor="skip-mode">Their turn</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as ChoreSkipMode)}>
              <SelectTrigger id="skip-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DEFER">Defer — they still owe a turn this cycle</SelectItem>
                <SelectItem value="FORFEIT">Forfeit — their turn counts as used</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="skip-away">
              Away until <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="skip-away"
              type="datetime-local"
              value={awayUntil}
              onChange={(e) => setAwayUntil(e.target.value)}
            />
          </div>
        </ReasonForm>
      );
    case "waive":
      return (
        <ReasonForm
          placeholder="Covered by someone else's work…"
          submitLabel="Waive"
          isPending={waive.isPending}
          onSubmit={(reason) => waive.mutate({ ...target, reason: reason ?? "" }, done)}
          onCancel={onDone}
        />
      );
    default:
      return null;
  }
}
