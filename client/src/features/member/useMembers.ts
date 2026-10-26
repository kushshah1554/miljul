import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  listMembers,
  removeMember,
  transferOwnership,
} from "@/features/member/member.api";
import { groupKeys } from "@/features/group/useGroups";

// ─── Query keys ───────────────────────────────────────────────────────────────
export const memberKeys = {
  list: (groupId: string) => ["groups", "detail", groupId, "members"] as const,
};

/** Membership changes affect the member list, my role and memberCount — refetch all of it. */
function useRefreshGroup(groupId: string) {
  const queryClient = useQueryClient();
  return () => {
    // detail key is a prefix of the members key, so this refetches both
    queryClient.invalidateQueries({ queryKey: groupKeys.detail(groupId) });
    queryClient.invalidateQueries({ queryKey: ["groups", "list"] });
  };
}

// ─── Queries ──────────────────────────────────────────────────────────────────
export function useMembers(groupId: string) {
  return useQuery({
    queryKey: memberKeys.list(groupId),
    queryFn: () => listMembers(groupId),
    select: (data) => data.members,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────
export function useRemoveMember(groupId: string) {
  const refreshGroup = useRefreshGroup(groupId);

  return useMutation({
    mutationFn: (userId: string) => removeMember(groupId, userId),
    onSuccess: () => {
      refreshGroup();
      toast.success("Member removed");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useLeaveGroup(groupId: string, myUserId: string) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: () => removeMember(groupId, myUserId),
    onSuccess: () => {
      // Drop the group's cache first so the detail page doesn't refetch a 404
      queryClient.removeQueries({ queryKey: groupKeys.detail(groupId) });
      queryClient.invalidateQueries({ queryKey: groupKeys.all });
      toast.success("You left the group");
      navigate("/groups", { replace: true });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useTransferOwnership(groupId: string) {
  const refreshGroup = useRefreshGroup(groupId);

  return useMutation({
    mutationFn: (newOwnerId: string) => transferOwnership(groupId, { newOwnerId }),
    onSuccess: ({ membership }) => {
      refreshGroup();
      toast.success(`${membership.user.name} is now the owner`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
