import {
  Controller,
  useFieldArray,
  useForm,
  type FieldErrors,
  type UseFormRegister,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import { useAuthStore } from "@/features/auth/authStore";
import {
  createChoreSchema,
  editChoreSchema,
  type ChoreFormValues,
} from "@/features/chore/chore.schema";
import { useCreateChore, useUpdateChore } from "@/features/chore/useChores";
import { useMembers } from "@/features/member/useMembers";
import { minutesToTime } from "@/lib/time";
import type { ChoreDetail, GroupMemberRecord } from "@/lib/types";

/** Create a chore, or edit `chore`'s settings when given (OWNER). */
export function ChoreFormSheet({
  groupId,
  open,
  onOpenChange,
  chore,
}: {
  groupId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chore?: ChoreDetail;
}) {
  const { data: members, isPending, isError, error } = useMembers(groupId);
  const close = () => onOpenChange(false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{chore ? "Edit chore" : "New chore"}</SheetTitle>
          <SheetDescription>
            {chore
              ? "Interval, deadline and fine changes apply to turns created from now on."
              : "Members take turns in the order you tick them."}
          </SheetDescription>
        </SheetHeader>

        {/* Mount only while open so each opening starts fresh */}
        {open && chore && <EditChoreForm groupId={groupId} chore={chore} onDone={close} />}
        {open && !chore && (
          <>
            {isPending && (
              <div className="space-y-2 px-4">
                {Array.from({ length: 4 }, (_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            )}
            {isError && <p className="px-4 text-sm text-destructive">{error.message}</p>}
            {members && <CreateChoreForm groupId={groupId} members={members} onDone={close} />}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** Name, description, interval, deadline and fine: shared by both forms. */
function SettingsFields({
  register,
  errors,
}: {
  register: UseFormRegister<ChoreFormValues>;
  errors: FieldErrors<ChoreFormValues>;
}) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="chore-name">Name</Label>
        <Input id="chore-name" placeholder="Wash dishes" aria-invalid={!!errors.name} {...register("name")} />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="chore-description">Description</Label>
        <Input id="chore-description" aria-invalid={!!errors.description} {...register("description")} />
        {errors.description && (
          <p className="text-sm text-destructive">{errors.description.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="chore-interval">Turn length (days)</Label>
          <Input
            id="chore-interval"
            inputMode="numeric"
            aria-invalid={!!errors.intervalDays}
            {...register("intervalDays")}
          />
          {errors.intervalDays && (
            <p className="text-sm text-destructive">{errors.intervalDays.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="chore-deadline">Due at</Label>
          <Input
            id="chore-deadline"
            type="time"
            aria-invalid={!!errors.deadlineTime}
            {...register("deadlineTime")}
          />
          {errors.deadlineTime && (
            <p className="text-sm text-destructive">{errors.deadlineTime.message}</p>
          )}
        </div>
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">
        A turn is due at this time on the day after it ends.
      </p>

      <div className="space-y-2">
        <Label htmlFor="chore-fine">Fine per member</Label>
        <Input
          id="chore-fine"
          inputMode="decimal"
          placeholder="20.00"
          aria-invalid={!!errors.finePerMember}
          {...register("finePerMember")}
        />
        <p className="text-xs text-muted-foreground">
          A late or rejected turn pays this to every other member.
        </p>
        {errors.finePerMember && (
          <p className="text-sm text-destructive">{errors.finePerMember.message}</p>
        )}
      </div>
    </>
  );
}

function EditChoreForm({
  groupId,
  chore,
  onDone,
}: {
  groupId: string;
  chore: ChoreDetail;
  onDone: () => void;
}) {
  const update = useUpdateChore(groupId, chore.id);
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<ChoreFormValues>({
    resolver: zodResolver(editChoreSchema),
    defaultValues: {
      name: chore.name,
      description: chore.description ?? "",
      intervalDays: String(chore.intervalDays),
      deadlineTime: minutesToTime(chore.deadlineMinutes),
      finePerMember: chore.finePerMember,
      startDate: "",
      participantIds: [],
      checklist: [],
    },
  });

  const onSubmit = (v: ChoreFormValues) =>
    update.mutate(
      {
        name: v.name,
        description: v.description || null,
        intervalDays: Number(v.intervalDays),
        deadlineTime: v.deadlineTime,
        finePerMember: v.finePerMember,
      },
      { onSuccess: onDone },
    );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 px-4 pb-4" noValidate>
      <SettingsFields register={register} errors={errors} />
      <Button type="submit" className="w-full" disabled={update.isPending || !isDirty}>
        {update.isPending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}

function CreateChoreForm({
  groupId,
  members,
  onDone,
}: {
  groupId: string;
  members: GroupMemberRecord[];
  onDone: () => void;
}) {
  const myUserId = useAuthStore((s) => s.user?.id ?? "");
  const navigate = useNavigate();
  const create = useCreateChore(groupId);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ChoreFormValues>({
    resolver: zodResolver(createChoreSchema),
    defaultValues: {
      name: "",
      description: "",
      intervalDays: "1",
      deadlineTime: "11:30",
      finePerMember: "20.00",
      startDate: "",
      participantIds: members.map((m) => m.userId),
      checklist: [],
    },
  });
  const checklist = useFieldArray({ control, name: "checklist" });

  const onSubmit = (v: ChoreFormValues) =>
    create.mutate(
      {
        name: v.name,
        description: v.description || undefined,
        intervalDays: Number(v.intervalDays),
        deadlineTime: v.deadlineTime,
        finePerMember: v.finePerMember,
        startDate: v.startDate || undefined,
        participantIds: v.participantIds,
        checklist: v.checklist.map((i) => i.label),
      },
      {
        onSuccess: ({ chore }) => {
          onDone();
          navigate(`/groups/${groupId}/chores/${chore.id}`);
        },
      },
    );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 px-4 pb-4" noValidate>
      <SettingsFields register={register} errors={errors} />

      <div className="space-y-2">
        <Label htmlFor="chore-start">
          First turn starts <span className="font-normal text-muted-foreground">(default today)</span>
        </Label>
        <Input id="chore-start" type="date" {...register("startDate")} />
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Who takes turns</legend>
        <Controller
          control={control}
          name="participantIds"
          render={({ field }) => (
            <ul className="space-y-2">
              {members.map((m) => {
                const index = field.value.indexOf(m.userId);
                const toggle = (checked: boolean) =>
                  field.onChange(
                    checked
                      ? [...field.value, m.userId]
                      : field.value.filter((id) => id !== m.userId),
                  );
                return (
                  <li key={m.userId} className="flex items-center gap-3">
                    <Checkbox
                      id={`participant-${m.userId}`}
                      checked={index >= 0}
                      onCheckedChange={(c) => toggle(c === true)}
                    />
                    <Label
                      htmlFor={`participant-${m.userId}`}
                      className="min-w-0 flex-1 truncate font-normal"
                    >
                      {m.user.name}
                      {m.userId === myUserId ? " (you)" : ""}
                    </Label>
                    <span className="w-8 text-right font-mono text-xs text-muted-foreground">
                      {index >= 0 ? `#${index + 1}` : ""}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        />
        {errors.participantIds && (
          <p className="text-sm text-destructive">{errors.participantIds.message}</p>
        )}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Checklist</legend>
        <p className="text-xs text-muted-foreground">Reviewers tick these off.</p>
        {checklist.fields.map((field, i) => (
          <div key={field.id} className="flex items-center gap-2">
            <Input
              placeholder={`Item ${i + 1}`}
              aria-label={`Checklist item ${i + 1}`}
              aria-invalid={!!errors.checklist?.[i]?.label}
              {...register(`checklist.${i}.label`)}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Remove item"
              onClick={() => checklist.remove(i)}
            >
              <X />
            </Button>
          </div>
        ))}
        {checklist.fields.length < 30 && (
          <Button type="button" variant="outline" size="sm" onClick={() => checklist.append({ label: "" })}>
            <Plus /> Add item
          </Button>
        )}
        {errors.checklist?.some?.((e) => e?.label) && (
          <p className="text-sm text-destructive">Every item needs a label (max 200 characters)</p>
        )}
      </fieldset>

      <Button type="submit" className="w-full" disabled={create.isPending}>
        {create.isPending ? "Creating…" : "Create chore"}
      </Button>
    </form>
  );
}
