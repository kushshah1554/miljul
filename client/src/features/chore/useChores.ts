import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  addParticipant,
  archiveChore,
  createChore,
  getChore,
  listChores,
  listPauses,
  moveInCycle,
  pauseAllChores,
  pauseChore,
  removeParticipant,
  reorderOriginalQueue,
  replaceChecklist,
  restoreChore,
  resumeAllChores,
  resumeChore,
  setAvailability,
  swapInCycle,
  updateChore,
} from "@/features/chore/chore.api";
import type {
  AddParticipantBody,
  ChecklistItemInput,
  CreateChoreBody,
  CurrentTurnChoice,
  ListPausesQuery,
  SetAvailabilityBody,
  UpdateChoreBody,
} from "@/features/chore/chore.api";
import { groupKeys } from "@/features/group/useGroups";
import type { ChoreStatus } from "@/lib/types";

// ─── Query keys ───────────────────────────────────────────────────────────────
// Chores, assignments, fines and pauses all live under one subtree: the server
// advances rotations and records fines on every request, so any chore change
// can move all of them.
export const choreKeys = {
  all: (groupId: string) => [...groupKeys.detail(groupId), "chores"] as const,
  list: (groupId: string, status?: ChoreStatus) =>
    [...choreKeys.all(groupId), "list", status ?? "default"] as const,
  detail: (groupId: string, choreId: string) =>
    [...choreKeys.all(groupId), "detail", choreId] as const,
  pauses: (groupId: string, query: ListPausesQuery) =>
    [...choreKeys.all(groupId), "pauses", query] as const,
};

/**
 * Shared mutation wrapper for every chore-related write: refetches the chore
 * subtree (or the whole group when `group` is set, e.g. pause-all changes
 * group.choresPausedAt) and toasts the outcome.
 */
export function useChoreMutation<TVars, TData>(
  groupId: string,
  mutationFn: (vars: TVars) => Promise<TData>,
  success: string | ((data: TData) => string),
  options: { group?: boolean } = {},
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: options.group ? groupKeys.detail(groupId) : choreKeys.all(groupId),
      });
      toast.success(typeof success === "function" ? success(data) : success);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// ─── Queries ──────────────────────────────────────────────────────────────────
export function useChores(groupId: string, status?: ChoreStatus) {
  return useQuery({
    queryKey: choreKeys.list(groupId, status),
    queryFn: () => listChores(groupId, status),
  });
}

export function useChore(groupId: string, choreId: string, upcoming?: number) {
  return useQuery({
    queryKey: [...choreKeys.detail(groupId, choreId), upcoming ?? 10],
    queryFn: () => getChore(groupId, choreId, upcoming),
    select: (data) => data.chore,
  });
}

export function usePauses(groupId: string, query: ListPausesQuery = {}) {
  return useQuery({
    queryKey: choreKeys.pauses(groupId, query),
    queryFn: () => listPauses(groupId, query),
    select: ({ data, meta }) => ({ pauses: data.pauses, meta }),
    placeholderData: keepPreviousData,
  });
}

// ─── Chores ───────────────────────────────────────────────────────────────────
export function useCreateChore(groupId: string) {
  return useChoreMutation(
    groupId,
    (body: CreateChoreBody) => createChore(groupId, body),
    ({ chore }) => `Chore "${chore.name}" created`,
  );
}

export function useUpdateChore(groupId: string, choreId: string) {
  return useChoreMutation(
    groupId,
    (body: UpdateChoreBody) => updateChore(groupId, choreId, body),
    "Chore updated",
  );
}

export function useArchiveChore(groupId: string, choreId: string) {
  return useChoreMutation(
    groupId,
    (reason?: string) => archiveChore(groupId, choreId, reason),
    "Chore archived",
  );
}

export function useRestoreChore(groupId: string, choreId: string) {
  return useChoreMutation(groupId, () => restoreChore(groupId, choreId), "Chore restored");
}

// ─── Participants ─────────────────────────────────────────────────────────────
export function useAddParticipant(groupId: string, choreId: string) {
  return useChoreMutation(
    groupId,
    (body: AddParticipantBody) => addParticipant(groupId, choreId, body),
    "Participant added",
  );
}

export function useRemoveParticipant(groupId: string, choreId: string) {
  return useChoreMutation(
    groupId,
    ({ userId, currentTurn }: { userId: string; currentTurn?: CurrentTurnChoice }) =>
      removeParticipant(groupId, choreId, userId, currentTurn),
    "Participant removed",
  );
}

export function useSetAvailability(groupId: string, choreId: string) {
  return useChoreMutation(
    groupId,
    ({ userId, ...body }: { userId: string } & SetAvailabilityBody) =>
      setAvailability(groupId, choreId, userId, body),
    ({ participant }) =>
      participant.unavailableUntil
        ? `${participant.user.name} marked away`
        : `${participant.user.name} is available`,
  );
}

// ─── Queues ───────────────────────────────────────────────────────────────────
export function useReorderOriginalQueue(groupId: string, choreId: string) {
  return useChoreMutation(
    groupId,
    (order: string[]) => reorderOriginalQueue(groupId, choreId, order),
    "Default order saved — it applies from the next cycle",
  );
}

export function useSwapInCycle(groupId: string, choreId: string) {
  return useChoreMutation(
    groupId,
    ({ userIdA, userIdB }: { userIdA: string; userIdB: string }) =>
      swapInCycle(groupId, choreId, userIdA, userIdB),
    "Turns swapped",
  );
}

export function useMoveInCycle(groupId: string, choreId: string) {
  return useChoreMutation(
    groupId,
    ({ userId, toIndex }: { userId: string; toIndex: number }) =>
      moveInCycle(groupId, choreId, userId, toIndex),
    "Queue updated",
  );
}

// ─── Checklist ────────────────────────────────────────────────────────────────
export function useReplaceChecklist(groupId: string, choreId: string) {
  return useChoreMutation(
    groupId,
    (items: ChecklistItemInput[]) => replaceChecklist(groupId, choreId, items),
    "Checklist saved",
  );
}

// ─── Pause / resume ───────────────────────────────────────────────────────────
export function usePauseChore(groupId: string, choreId: string) {
  return useChoreMutation(
    groupId,
    (reason?: string) => pauseChore(groupId, choreId, reason),
    "Chore paused",
  );
}

export function useResumeChore(groupId: string, choreId: string) {
  return useChoreMutation(
    groupId,
    (reason?: string) => resumeChore(groupId, choreId, reason),
    ({ chore }) =>
      chore.isFrozen ? "Chore resumed — still frozen by the group-wide pause" : "Chore resumed",
  );
}

export function usePauseAllChores(groupId: string) {
  return useChoreMutation(
    groupId,
    (reason?: string) => pauseAllChores(groupId, reason),
    "All chores paused",
    { group: true },
  );
}

export function useResumeAllChores(groupId: string) {
  return useChoreMutation(
    groupId,
    (reason?: string) => resumeAllChores(groupId, reason),
    "All chores resumed",
    { group: true },
  );
}
