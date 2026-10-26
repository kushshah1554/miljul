import { Outlet, useOutletContext, useParams } from "react-router-dom";
import { Archive } from "lucide-react";

import { useGroup } from "@/features/group/useGroups";
import type { Group } from "@/lib/types";

/** Shared shell for /groups/:groupId/* — loads the group once and passes it to the sub-page. */
export default function GroupLayout() {
  const { groupId = "" } = useParams();
  const { data: group, isPending, isError, error } = useGroup(groupId);

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-6 md:py-8 space-y-6">
      {isPending && <p className="text-muted-foreground">Loading group…</p>}
      {isError && <p className="text-destructive">{error.message}</p>}

      {group && (
        <>
          <header className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">{group.name}</h1>
            <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
              {group.role}
            </span>
            {group.isArchived && (
              <span className="flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                <Archive className="size-3.5" /> Archived
              </span>
            )}
          </header>

          {group.isArchived && (
            <p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">
              This group is archived and read-only. Its history is preserved.
            </p>
          )}

          <Outlet context={group} />
        </>
      )}
    </div>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCurrentGroup() {
  return useOutletContext<Group>();
}
