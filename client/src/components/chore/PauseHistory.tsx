import { useState } from "react";
import { Pause } from "lucide-react";

import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { usePauses } from "@/features/chore/useChores";
import { formatDateTime } from "@/lib/time";

const PAGE_SIZE = 5;

/** Pause history of one chore, or of the whole group when `choreId` is omitted. */
export function PauseHistory({
  groupId,
  choreId,
  timeZone,
  choreNames,
}: {
  groupId: string;
  choreId?: string;
  timeZone: string;
  /** choreId → name, to label rows in the group-wide list */
  choreNames?: Map<string, string>;
}) {
  const [page, setPage] = useState(1);
  const { data, isPending, isError, error, isPlaceholderData } = usePauses(groupId, {
    choreId,
    page,
    limit: PAGE_SIZE,
  });

  return (
    <section className="surface space-y-3">
      <h2 className="text-lg font-semibold">Pause history</h2>
      {isPending && <Skeleton className="h-12 w-full" />}
      {isError && <p className="text-sm text-destructive">{error.message}</p>}
      {data?.pauses.length === 0 && (
        <p className="text-sm text-muted-foreground">Never paused.</p>
      )}

      <ul className="space-y-1">
        {data?.pauses.map((p) => (
          <li key={p.id} className="flex items-start gap-3 rounded-2xl px-3 py-2.5 hover:bg-background/60">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-background">
              <Pause className="size-4" />
            </span>
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-medium">
                {p.choreId === null
                  ? "All chores"
                  : (choreNames?.get(p.choreId) ?? (choreId ? "This chore" : "A chore"))}
                <span className="font-normal text-muted-foreground">
                  {" "}· paused by {p.pausedBy.name}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDateTime(p.pausedAt, timeZone)} →{" "}
                {p.resumedAt ? formatDateTime(p.resumedAt, timeZone) : "still paused"}
                {p.resumedBy && ` (by ${p.resumedBy.name})`}
              </p>
              {(p.reason || p.resumeReason) && (
                <p className="text-xs text-muted-foreground">
                  {p.reason && `“${p.reason}”`}
                  {p.reason && p.resumeReason && " · "}
                  {p.resumeReason && `resumed: “${p.resumeReason}”`}
                </p>
              )}
            </div>
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
