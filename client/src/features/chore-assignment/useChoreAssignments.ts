import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  getAssignment,
  listChoreAssignments,
  listMyAssignments,
  requestSkip,
  reviewAssignment,
  skipAssignment,
  submitAssignment,
  waiveAssignment,
} from "@/features/chore-assignment/chore-assignment.api";
import type {
  ListAssignmentsQuery,
  MyAssignmentsQuery,
  ReviewBody,
  SkipBody,
  WaiveBody,
} from "@/features/chore-assignment/chore-assignment.api";
import { choreKeys, useChoreMutation } from "@/features/chore/useChores";

// ─── Query keys ───────────────────────────────────────────────────────────────
// Under the chore subtree so every chore mutation refetches them too
export const assignmentKeys = {
  all: (groupId: string) => [...choreKeys.all(groupId), "assignments"] as const,
  list: (groupId: string, choreId: string, query: ListAssignmentsQuery) =>
    [...assignmentKeys.all(groupId), "list", choreId, query] as const,
  mine: (groupId: string, query: MyAssignmentsQuery) =>
    [...assignmentKeys.all(groupId), "mine", query] as const,
  detail: (groupId: string, assignmentId: string) =>
    [...assignmentKeys.all(groupId), "detail", assignmentId] as const,
};

// ─── Queries ──────────────────────────────────────────────────────────────────
export function useChoreAssignments(
  groupId: string,
  choreId: string,
  query: ListAssignmentsQuery = {},
) {
  return useQuery({
    queryKey: assignmentKeys.list(groupId, choreId, query),
    queryFn: () => listChoreAssignments(groupId, choreId, query),
    select: ({ data, meta }) => ({ assignments: data.assignments, meta }),
    placeholderData: keepPreviousData,
  });
}

export function useMyAssignments(groupId: string, query: MyAssignmentsQuery = {}) {
  return useQuery({
    queryKey: assignmentKeys.mine(groupId, query),
    queryFn: () => listMyAssignments(groupId, query),
    select: ({ data, meta }) => ({ assignments: data.assignments, meta }),
    placeholderData: keepPreviousData,
  });
}

export function useAssignment(groupId: string, choreId: string, assignmentId: string) {
  return useQuery({
    queryKey: assignmentKeys.detail(groupId, assignmentId),
    queryFn: () => getAssignment(groupId, choreId, assignmentId),
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────
// All actions target one assignment of one chore
type Target = { choreId: string; assignmentId: string };

export function useSubmitAssignment(groupId: string) {
  return useChoreMutation(
    groupId,
    ({ choreId, assignmentId, note }: Target & { note?: string }) =>
      submitAssignment(groupId, choreId, assignmentId, note),
    "Submitted for review",
  );
}

export function useReviewAssignment(groupId: string) {
  return useChoreMutation(
    groupId,
    ({ choreId, assignmentId, ...body }: Target & ReviewBody) =>
      reviewAssignment(groupId, choreId, assignmentId, body),
    ({ review }) => (review.decision === "APPROVED" ? "Work approved" : "Work rejected"),
  );
}

export function useRequestSkip(groupId: string) {
  return useChoreMutation(
    groupId,
    ({ choreId, assignmentId, reason }: Target & { reason: string }) =>
      requestSkip(groupId, choreId, assignmentId, reason),
    "Skip requested — the owner will decide",
  );
}

export function useSkipAssignment(groupId: string) {
  return useChoreMutation(
    groupId,
    ({ choreId, assignmentId, ...body }: Target & SkipBody) =>
      skipAssignment(groupId, choreId, assignmentId, body),
    ({ takeover }) =>
      takeover
        ? `Turn skipped — ${takeover.user.name} takes over`
        : "Turn skipped — nobody is available, the chore needs attention",
  );
}

export function useWaiveAssignment(groupId: string) {
  return useChoreMutation(
    groupId,
    ({ choreId, assignmentId, ...body }: Target & WaiveBody) =>
      waiveAssignment(groupId, choreId, assignmentId, body),
    "Assignment waived",
  );
}
