import { useQuery } from "@tanstack/react-query";
import { getGroupBalances, getMyBalance } from "@/features/balance/balance.api";
import { groupKeys } from "@/features/group/useGroups";

// ─── Query keys ───────────────────────────────────────────────────────────────
// Nested under the group's detail key, so membership changes refetch balances too
export const balanceKeys = {
  all: (groupId: string) => [...groupKeys.detail(groupId), "balances"] as const,
  group: (groupId: string) => [...balanceKeys.all(groupId), "group"] as const,
  me: (groupId: string) => [...balanceKeys.all(groupId), "me"] as const,
};

// ─── Queries ──────────────────────────────────────────────────────────────────
export function useGroupBalances(groupId: string) {
  return useQuery({
    queryKey: balanceKeys.group(groupId),
    queryFn: () => getGroupBalances(groupId),
  });
}

export function useMyBalance(groupId: string) {
  return useQuery({
    queryKey: balanceKeys.me(groupId),
    queryFn: () => getMyBalance(groupId),
  });
}
