import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createMessage,
  deleteMessage,
  listMessages,
  type ListMessagesQuery,
} from "@/features/anonymous-message/anonymous-message.api";
import { groupKeys } from "@/features/group/useGroups";

export const anonymousMessageKeys = {
  all: (groupId: string) => [...groupKeys.detail(groupId), "anonymous-messages"] as const,
  list: (groupId: string, query: ListMessagesQuery) =>
    [...anonymousMessageKeys.all(groupId), "list", query] as const,
};

export function useAnonymousMessages(groupId: string, query: ListMessagesQuery = {}) {
  return useQuery({
    queryKey: anonymousMessageKeys.list(groupId, query),
    queryFn: () => listMessages(groupId, query),
    select: ({ data, meta }) => ({ messages: data.messages, meta }),
    placeholderData: keepPreviousData,
  });
}

function useMessageMutation<T>(
  groupId: string,
  mutationFn: (arg: T) => Promise<unknown>,
  successMessage: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: anonymousMessageKeys.all(groupId) });
      toast.success(successMessage);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useCreateAnonymousMessage(groupId: string) {
  return useMessageMutation(
    groupId,
    (content: string) => createMessage(groupId, content),
    "Message posted anonymously",
  );
}

export function useDeleteAnonymousMessage(groupId: string) {
  return useMessageMutation(
    groupId,
    (messageId: string) => deleteMessage(groupId, messageId),
    "Message deleted",
  );
}
