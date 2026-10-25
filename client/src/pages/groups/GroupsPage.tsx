import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Archive, Plus, Users, LogIn } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  groupFormSchema,
  joinGroupSchema,
  type GroupFormValues,
  type JoinGroupFormValues,
} from "@/features/group/group.schema";
import {
  useCreateGroup,
  useGroups,
  useJoinGroup,
} from "@/features/group/useGroups";
import type { GroupStatus } from "@/features/group/group.api";

const STATUS_TABS: GroupStatus[] = ["active", "archived", "all"];

export default function GroupsPage() {
  const [status, setStatus] = useState<GroupStatus>("active");
  const { data: groups, isPending, isError, error } = useGroups(status);

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-6 md:py-8 space-y-8">
      <h1 className="text-2xl font-bold">My groups</h1>

      <div className="grid gap-8 md:grid-cols-[1fr_320px]">
        {/* Group list */}
        <section className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {STATUS_TABS.map((tab) => (
              <Button
                key={tab}
                size="sm"
                variant={status === tab ? "default" : "outline"}
                onClick={() => setStatus(tab)}
                className="capitalize"
              >
                {tab}
              </Button>
            ))}
          </div>

          {isPending && (
            <p className="text-muted-foreground">Loading groups…</p>
          )}
          {isError && <p className="text-destructive">{error.message}</p>}
          {groups?.length === 0 && (
            <p className="text-muted-foreground">
              No {status === "all" ? "" : status} groups yet.
            </p>
          )}

          <ul className="space-y-3">
            {groups?.map((group) => (
              <li key={group.id}>
                <Link
                  to={`/groups/${group.id}`}
                  className="block rounded-xl border border-border p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="font-semibold truncate">{group.name}</h2>
                      {group.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {group.description}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                      {group.isArchived && (
                        <span className="flex items-center gap-1">
                          <Archive className="size-3.5" /> Archived
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Users className="size-3.5" /> {group.memberCount}
                      </span>
                      <span className="rounded-md bg-muted px-2 py-0.5 font-medium">
                        {group.role}
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <aside className="space-y-6">
          <CreateGroupForm />
          <JoinGroupForm />
        </aside>
      </div>
    </div>
  );
}

function CreateGroupForm() {
  const { mutate: handleCreate, isPending } = useCreateGroup();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<GroupFormValues>({
    resolver: zodResolver(groupFormSchema),
    defaultValues: { name: "", description: "" },
  });

  const onSubmit = (data: GroupFormValues) => {
    handleCreate({ name: data.name, description: data.description || null });
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="rounded-xl border border-border p-4 space-y-4"
      noValidate
    >
      <h2 className="font-semibold">Create a group</h2>

      <div className="space-y-2">
        <Label htmlFor="create-name">Name</Label>
        <Input
          id="create-name"
          placeholder="Flat 4B"
          aria-invalid={!!errors.name}
          {...register("name")}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="create-description">Description (optional)</Label>
        <Input
          id="create-description"
          placeholder="Rent, groceries and bills"
          aria-invalid={!!errors.description}
          {...register("description")}
        />
        {errors.description && (
          <p className="text-sm text-destructive">
            {errors.description.message}
          </p>
        )}
      </div>

      <Button type="submit" disabled={isPending} className="w-full">
        <Plus /> {isPending ? "Creating…" : "Create group"}
      </Button>
    </form>
  );
}

function JoinGroupForm() {
  const { mutate: handleJoin, isPending } = useJoinGroup();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<JoinGroupFormValues>({
    resolver: zodResolver(joinGroupSchema),
    defaultValues: { joinCode: "" },
  });

  return (
    <form
      onSubmit={handleSubmit((data) => handleJoin(data))}
      className="rounded-xl border border-border p-4 space-y-4"
      noValidate
    >
      <h2 className="font-semibold">Join with a code</h2>

      <div className="space-y-2">
        <Label htmlFor="join-code">Join code</Label>
        <Input
          id="join-code"
          placeholder="ABCD1234"
          maxLength={8}
          autoComplete="off"
          className="uppercase tracking-widest font-mono"
          aria-invalid={!!errors.joinCode}
          {...register("joinCode")}
        />
        {errors.joinCode && (
          <p className="text-sm text-destructive">{errors.joinCode.message}</p>
        )}
      </div>

      <Button
        type="submit"
        variant="outline"
        disabled={isPending}
        className="w-full"
      >
        <LogIn /> {isPending ? "Joining…" : "Join group"}
      </Button>
    </form>
  );
}
