import { useState, type FormEvent } from "react";
import { Send, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { confirm } from "@/components/ui/confirm-dialog";
import { Label } from "@/components/ui/label";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAnonymousMessages,
  useCreateAnonymousMessage,
  useDeleteAnonymousMessage,
} from "@/features/anonymous-message/useAnonymousMessages";
import { isOwner } from "@/lib/roles";
import { useCurrentGroup } from "@/pages/groups/GroupLayout";

const PAGE_SIZE = 10;
const MAX_LENGTH = 1000;

export default function GroupAnonymousMessagesPage() {
  const group = useCurrentGroup();
  const [content, setContent] = useState("");
  const [page, setPage] = useState(1);
  const { data, isPending, isError, error, isPlaceholderData } = useAnonymousMessages(group.id, {
    page,
    limit: PAGE_SIZE,
  });
  const create = useCreateAnonymousMessage(group.id);
  const remove = useDeleteAnonymousMessage(group.id);
  const canModerate = isOwner(group.role) && !group.isArchived;
  const canDelete = (isMine: boolean) => !group.isArchived && (isMine || canModerate);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const text = content.trim();
    if (!text) return;
    create.mutate(text, {
      onSuccess: () => {
        setContent("");
        setPage(1);
      },
    });
  };

  const handleDelete = async (messageId: string) => {
    if (
      await confirm({
        title: "Delete this message?",
        description: "It will be removed for everyone.",
        confirmText: "Delete",
        destructive: true,
      })
    ) {
      remove.mutate(messageId);
    }
  };

  return (
    <section className="surface space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Anonymous messages</h2>
        <p className="text-sm text-muted-foreground">
          Raise a complaint or concern. Your name is never stored with the message. You can post up to 3 messages a day.
        </p>
      </div>

      {!group.isArchived && (
        <form onSubmit={handleSubmit} className="space-y-2">
          <Label htmlFor="anon-message" className="sr-only">
            Message
          </Label>
          <textarea
            id="anon-message"
            rows={3}
            maxLength={MAX_LENGTH}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your message…"
            className="w-full resize-y rounded-xl border border-input bg-background px-3 py-2 text-base shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:pointer-fine:text-sm"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {content.length}/{MAX_LENGTH}
            </span>
            <Button type="submit" size="sm" disabled={!content.trim() || create.isPending}>
              <Send /> Post anonymously
            </Button>
          </div>
        </form>
      )}

      {isPending && (
        <div className="space-y-2">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      )}
      {isError && <p className="text-sm text-destructive">{error.message}</p>}
      {data?.messages.length === 0 && (
        <p className="text-sm text-muted-foreground">No messages yet.</p>
      )}

      <ul className="space-y-2">
        {data?.messages.map((message) => (
          <li
            key={message.id}
            className="flex items-start gap-3 rounded-2xl bg-background/70 px-3 py-2.5"
          >
            <div className="min-w-0 flex-1">
              <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Anonymous · {new Date(message.createdAt).toLocaleString()}
              </p>
            </div>
            {canDelete(message.isMine) && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Delete message"
                disabled={remove.isPending}
                onClick={() => handleDelete(message.id)}
              >
                <Trash2 />
              </Button>
            )}
          </li>
        ))}
      </ul>

      {data && data.meta.totalPages > 1 && (
        <Pagination
          page={data.meta.page}
          totalPages={data.meta.totalPages}
          total={data.meta.total}
          limit={data.meta.limit}
          onPageChange={setPage}
          disabled={isPlaceholderData}
        />
      )}
    </section>
  );
}
