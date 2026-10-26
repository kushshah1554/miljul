import { Navigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Archive, ArchiveRestore, Copy, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  groupFormSchema,
  type GroupFormValues,
} from "@/features/group/group.schema";
import {
  useArchiveGroup,
  useRegenerateJoinCode,
  useRestoreGroup,
  useUpdateGroup,
} from "@/features/group/useGroups";
import { isOwner } from "@/lib/roles";
import type { Group } from "@/lib/types";
import { useCurrentGroup } from "@/pages/groups/GroupLayout";

export default function GroupSettingsPage() {
  const group = useCurrentGroup();

  // Settings are owner-only; members land on the overview instead
  if (!isOwner(group.role)) return <Navigate to=".." relative="path" replace />;

  return (
    <>
      {!group.isArchived && (
        <>
          <JoinCodeCard group={group} />
          {/* key resets the form to the saved values after each update */}
          <EditGroupForm key={group.updatedAt} group={group} />
        </>
      )}
      <LifecycleCard group={group} />
    </>
  );
}

function JoinCodeCard({ group }: { group: Group }) {
  const { mutate: handleRegenerate, isPending } = useRegenerateJoinCode(
    group.id,
  );

  const copyCode = async () => {
    if (!group.joinCode) return;
    try {
      await navigator.clipboard.writeText(group.joinCode);
      toast.success("Join code copied");
    } catch {
      toast.error("Could not copy — select the code and copy it manually");
    }
  };

  const regenerate = () => {
    if (
      window.confirm(
        "Generate a new code? The current code will stop working immediately.",
      )
    ) {
      handleRegenerate();
    }
  };

  return (
    <section className="surface space-y-3">
      <h2 className="text-lg font-semibold">Join code</h2>
      <p className="text-sm text-muted-foreground">
        Share this code so others can join the group.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <code className="rounded-full bg-background px-4 py-1.5 font-mono text-lg tracking-widest select-all">
          {group.joinCode ?? "—"}
        </code>
        <Button
          variant="outline"
          size="sm"
          onClick={copyCode}
          disabled={!group.joinCode}
        >
          <Copy /> Copy
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={regenerate}
          disabled={isPending}
        >
          <RefreshCw /> {isPending ? "Generating…" : "Regenerate"}
        </Button>
      </div>
    </section>
  );
}

function EditGroupForm({ group }: { group: Group }) {
  const { mutate: handleUpdate, isPending } = useUpdateGroup(group.id);
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<GroupFormValues>({
    resolver: zodResolver(groupFormSchema),
    defaultValues: { name: group.name, description: group.description ?? "" },
  });

  const onSubmit = (data: GroupFormValues) => {
    // Empty description clears it on the server
    handleUpdate({ name: data.name, description: data.description || null });
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="surface space-y-4"
      noValidate
    >
      <h2 className="text-lg font-semibold">Group details</h2>

      <div className="space-y-2">
        <Label htmlFor="edit-name">Name</Label>
        <Input
          id="edit-name"
          aria-invalid={!!errors.name}
          {...register("name")}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="edit-description">Description</Label>
        <Input
          id="edit-description"
          aria-invalid={!!errors.description}
          {...register("description")}
        />
        {errors.description && (
          <p className="text-sm text-destructive">
            {errors.description.message}
          </p>
        )}
      </div>

      <Button type="submit" disabled={isPending || !isDirty}>
        {isPending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}

function LifecycleCard({ group }: { group: Group }) {
  const archive = useArchiveGroup(group.id);
  const restore = useRestoreGroup(group.id);

  const handleArchive = () => {
    if (
      window.confirm(
        `Archive "${group.name}"? It becomes read-only until restored.`,
      )
    ) {
      archive.mutate();
    }
  };

  return (
    <section className="surface space-y-3">
      <h2 className="text-lg font-semibold">
        {group.isArchived ? "Restore group" : "Archive group"}
      </h2>
      <p className="text-sm text-muted-foreground">
        {group.isArchived
          ? "Make the group active again so members can add expenses."
          : "Archived groups are read-only, but all history is kept."}
      </p>
      {group.isArchived ? (
        <Button
          variant="outline"
          onClick={() => restore.mutate()}
          disabled={restore.isPending}
        >
          <ArchiveRestore />{" "}
          {restore.isPending ? "Restoring…" : "Restore group"}
        </Button>
      ) : (
        <Button
          variant="destructive"
          onClick={handleArchive}
          disabled={archive.isPending}
        >
          <Archive /> {archive.isPending ? "Archiving…" : "Archive group"}
        </Button>
      )}
    </section>
  );
}
