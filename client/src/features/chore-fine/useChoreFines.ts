import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getFineSummary, listFines, voidFine } from "@/features/chore-fine/chore-fine.api";
import type { ListFinesQuery } from "@/features/chore-fine/chore-fine.api";
import { choreKeys, useChoreMutation } from "@/features/chore/useChores";

// ─── Query keys ───────────────────────────────────────────────────────────────
// Under the chore subtree: reviews and the deadline job create fines
export const fineKeys = {
  all: (groupId: string) => [...choreKeys.all(groupId), "fines"] as const,
  list: (groupId: string, query: ListFinesQuery) =>
    [...fineKeys.all(groupId), "list", query] as const,
  summary: (groupId: string) => [...fineKeys.all(groupId), "summary"] as const,
};

// ─── Queries ──────────────────────────────────────────────────────────────────
export function useFines(groupId: string, query: ListFinesQuery = {}) {
  return useQuery({
    queryKey: fineKeys.list(groupId, query),
    queryFn: () => listFines(groupId, query),
    select: ({ data, meta }) => ({ fines: data.fines, meta }),
    placeholderData: keepPreviousData,
  });
}

export function useFineSummary(groupId: string) {
  return useQuery({
    queryKey: fineKeys.summary(groupId),
    queryFn: () => getFineSummary(groupId),
    select: (data) => data.members,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────
export function useVoidFine(groupId: string) {
  return useChoreMutation(
    groupId,
    ({ fineId, reason }: { fineId: string; reason: string }) => voidFine(groupId, fineId, reason),
    "Fine voided",
  );
}
