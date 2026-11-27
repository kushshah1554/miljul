import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { groupKeys } from "@/features/group/useGroups";
import {
  getGroupLeaderboard,
  getGroupOverview,
} from "@/features/group-overview/group-overview.api";

// staleTime 0: expenses, chores and fines all change these numbers

export function useGroupOverview(groupId: string, year?: number) {
  return useQuery({
    queryKey: [...groupKeys.detail(groupId), "overview", year],
    queryFn: () => getGroupOverview(groupId, year),
    staleTime: 0,
    placeholderData: keepPreviousData, // no flash between years
  });
}

export function useGroupLeaderboard(groupId: string, year: number, month?: number) {
  return useQuery({
    queryKey: [...groupKeys.detail(groupId), "leaderboard", year, month],
    queryFn: () => getGroupLeaderboard(groupId, year, month),
    staleTime: 0,
    placeholderData: keepPreviousData, // no flash between periods
  });
}
