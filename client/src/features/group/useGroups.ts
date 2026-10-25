import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  archiveGroup,
  createGroup,
  getGroup,
  joinGroup,
  listGroups,
  regenerateJoinCode,
  restoreGroup,
  updateGroup,
} from "@/features/group/group.api";
import type {
  CreateGroupBody,
  GroupStatus,
  JoinGroupBody,
  UpdateGroupBody,
} from "@/features/group/group.api";
import type { Group } from "@/lib/types";

// ─── Query keys ───────────────────────────────────────────────────────────────
export const groupKeys = {
  all: ["groups"] as const,
  list: (status: GroupStatus) => ["groups", "list", status] as const,
  detail: (groupId: string) => ["groups", "detail", groupId] as const,
};

/** Put the fresh group in the detail cache and refetch every list. */
function useSyncGroup() {
  const queryClient = useQueryClient();
  return (group: Group) => {
    queryClient.setQueryData(groupKeys.detail(group.id), { group });
    queryClient.invalidateQueries({ queryKey: ["groups", "list"] });
  };
}

// ─── Queries ──────────────────────────────────────────────────────────────────
export function useGroups(status: GroupStatus = "active") {
  return useQuery({
    queryKey: groupKeys.list(status),
    queryFn: () => listGroups(status),
    select: (data) => data.groups,
  });
}

export function useGroup(groupId: string) {
  return useQuery({
    queryKey: groupKeys.detail(groupId),
    queryFn: () => getGroup(groupId),
    select: (data) => data.group,
  });
}

// ─── Create / Join (navigate to the group) ────────────────────────────────────
export function useCreateGroup() {
  const syncGroup = useSyncGroup();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (body: CreateGroupBody) => createGroup(body),
    onSuccess: ({ group }) => {
      syncGroup(group);
      toast.success(`Group "${group.name}" created`);
      navigate(`/groups/${group.id}`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useJoinGroup() {
  const syncGroup = useSyncGroup();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (body: JoinGroupBody) => joinGroup(body),
    onSuccess: ({ group }) => {
      syncGroup(group);
      toast.success(`Joined "${group.name}"`);
      navigate(`/groups/${group.id}`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// ─── Group settings (OWNER / ADMIN) ───────────────────────────────────────────
export function useUpdateGroup(groupId: string) {
  const syncGroup = useSyncGroup();

  return useMutation({
    mutationFn: (body: UpdateGroupBody) => updateGroup(groupId, body),
    onSuccess: ({ group }) => {
      syncGroup(group);
      toast.success("Group updated");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useRegenerateJoinCode(groupId: string) {
  const syncGroup = useSyncGroup();

  return useMutation({
    mutationFn: () => regenerateJoinCode(groupId),
    onSuccess: ({ group }) => {
      syncGroup(group);
      toast.success("New join code generated — the old one no longer works");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useArchiveGroup(groupId: string) {
  const syncGroup = useSyncGroup();

  return useMutation({
    mutationFn: () => archiveGroup(groupId),
    onSuccess: ({ group }) => {
      syncGroup(group);
      toast.success("Group archived");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useRestoreGroup(groupId: string) {
  const syncGroup = useSyncGroup();

  return useMutation({
    mutationFn: () => restoreGroup(groupId),
    onSuccess: ({ group }) => {
      syncGroup(group);
      toast.success("Group restored");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
