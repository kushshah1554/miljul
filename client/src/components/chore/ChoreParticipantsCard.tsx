import { useState } from "react";
import { CalendarClock, UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Pill } from "@/components/chore/ChoreBadges";
import { ReasonForm } from "@/components/chore/ReasonForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import {
  useAddParticipant,
  useRemoveParticipant,
  useSetAvailability,
} from "@/features/chore/useChores";
import { formatDateTime, localInputToIso } from "@/lib/time";
import type { ChoreDetail, ChoreParticipant, GroupMemberRecord } from "@/lib/types";

/** Who takes part in this chore; owners add, remove and mark people away. */
export function ChoreParticipantsCard({
  groupId,
  chore,
  members,
  canManage,
  timeZone,
}: {
  groupId: string;
  chore: ChoreDetail;
  members: GroupMemberRecord[];
  canManage: boolean;
  timeZone: string;
}) {
  const add = useAddParticipant(groupId, chore.id);
  const [newUserId, setNewUserId] = useState("");
  const active = new Set(chore.participants.map((p) => p.userId));
  const candidates = members.filter((m) => !active.has(m.userId));
  const editable = canManage && chore.status !== "ARCHIVED";

  return (
    <section className="surface space-y-3">
      <h2 className="text-lg font-semibold">Participants</h2>
      <ul className="space-y-1">
        {chore.participants.map((p) => (
          <ParticipantRow
            key={p.userId}
            groupId={groupId}
            chore={chore}
            participant={p}
            canManage={canManage}
            timeZone={timeZone}
          />
        ))}
      </ul>

      {editable && candidates.length > 0 && (
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1 space-y-1">
            <Label htmlFor="add-participant" className="text-xs">Add a member</Label>
            <Select value={newUserId} onValueChange={setNewUserId}>
              <SelectTrigger id="add-participant">
                <SelectValue placeholder="Select a member" />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((m) => (
                  <SelectItem key={m.userId} value={m.userId}>
                    {m.user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            disabled={!newUserId || add.isPending}
            onClick={() => add.mutate({ userId: newUserId }, { onSuccess: () => setNewUserId("") })}
          >
            <UserPlus /> {add.isPending ? "Adding…" : "Add"}
          </Button>
        </div>
      )}
    </section>
  );
}

type Mode = "availability" | "remove" | null;

function ParticipantRow({
  groupId,
  chore,
  participant: p,
  canManage,
  timeZone,
}: {
  groupId: string;
  chore: ChoreDetail;
  participant: ChoreParticipant;
  canManage: boolean;
  timeZone: string;
}) {
  const remove = useRemoveParticipant(groupId, chore.id);
  const availability = useSetAvailability(groupId, chore.id);
  const [mode, setMode] = useState<Mode>(null);
  const [until, setUntil] = useState("");

  const isAway = !!p.unavailableUntil && new Date(p.unavailableUntil) > new Date();
  const holdsTurn = chore.currentAssignment?.userId === p.userId;
  const done = { onSuccess: () => setMode(null) };

  const handleRemove = () => {
    // Removing whoever holds the current turn needs a decision about that turn
    if (holdsTurn) return setMode("remove");
    if (window.confirm(`Remove ${p.user.name} from "${chore.name}"? Their history is kept.`)) {
      remove.mutate({ userId: p.userId });
    }
  };

  return (
    <li className="space-y-2 rounded-2xl px-3 py-2.5 hover:bg-background/60">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{p.user.name}</p>
          {isAway && (
            <p className="truncate text-xs text-muted-foreground">
              Away until {formatDateTime(p.unavailableUntil!, timeZone)}
              {p.unavailableReason && ` · ${p.unavailableReason}`}
            </p>
          )}
        </div>
        {isAway && <Pill>Away</Pill>}
        {canManage && mode === null && (
          <div className="flex shrink-0 gap-0.5">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Set ${p.user.name}'s availability`}
              onClick={() => setMode("availability")}
            >
              <CalendarClock />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove ${p.user.name}`}
              disabled={remove.isPending}
              onClick={handleRemove}
            >
              <UserMinus />
            </Button>
          </div>
        )}
      </div>

      {mode === "availability" && (
        <ReasonForm
          required={false}
          placeholder="Sick, travelling…"
          submitLabel="Mark away"
          isPending={availability.isPending}
          onSubmit={(reason) => {
            if (!until) return void toast.error("Pick when they are back");
            availability.mutate(
              { userId: p.userId, unavailableUntil: localInputToIso(until), reason },
              done,
            );
          }}
          onCancel={() => setMode(null)}
        >
          <div className="space-y-2">
            <Label htmlFor={`away-${p.userId}`}>Away until</Label>
            <Input
              id={`away-${p.userId}`}
              type="datetime-local"
              value={until}
              onChange={(e) => setUntil(e.target.value)}
            />
          </div>
          {isAway && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={availability.isPending}
              onClick={() => availability.mutate({ userId: p.userId, unavailableUntil: null }, done)}
            >
              Available now
            </Button>
          )}
        </ReasonForm>
      )}

      {mode === "remove" && (
        <div className="space-y-2 rounded-2xl bg-background p-3 text-sm">
          <p>{p.user.name} holds the current turn. What should happen to it?</p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => remove.mutate({ userId: p.userId, currentTurn: "reassign" }, done)}
            >
              Give it to the next member
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={remove.isPending}
              onClick={() => remove.mutate({ userId: p.userId, currentTurn: "keep" }, done)}
            >
              Let them finish it
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMode(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
