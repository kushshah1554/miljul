import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getDashboard } from "@/features/dashboard/dashboard.api";
import { useAuthStore } from "@/features/auth/authStore";

export function useDashboard(year?: number) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ["dashboard", userId, year],
    queryFn: () => getDashboard(year),
    staleTime: 0, // expenses, chores and fines in any group change it
    placeholderData: keepPreviousData, // no flash between years
  });
}
