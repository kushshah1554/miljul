import { Outlet, useOutletContext, useParams } from "react-router-dom";
import { Archive } from "lucide-react";

import { useGroup } from "@/features/group/useGroups";
import type { Group } from "@/lib/types";

/** Shared shell for /groups/:groupId/* — loads the group once and passes it to the sub-page. */
export default function GroupLayout() {
  const { groupId = "" } = useParams();
  const { data: group, isPending, isError, error } = useGroup(groupId);

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-6 md:px-6 md:py-10 space-y-5">
      {isPending && <p className="text-muted-foreground">Loading group…</p>}
      {isError && <p className="text-destructive">{error.message}</p>}

      {group && (
        <>
          <header className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{group.name}</h1>
            <span className="rounded-full bg-card px-3 py-1 text-xs font-semibold">
              {group.role}
            </span>
            {group.isArchived && (
              <span className="flex items-center gap-1 rounded-full bg-destructive/10 px-3 py-1 text-xs font-semibold text-destructive">
                <Archive className="size-3.5" /> Archived
              </span>
            )}
          </header>

          {group.isArchived && (
            <p className="surface text-sm text-muted-foreground">
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
