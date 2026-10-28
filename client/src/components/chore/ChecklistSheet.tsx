import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import { checklistFormSchema, type ChecklistFormValues } from "@/features/chore/chore.schema";
import { useReplaceChecklist } from "@/features/chore/useChores";
import type { ChoreChecklistItem } from "@/lib/types";

/** Replace the active checklist; removed items are archived, past reviews keep their labels. */
export function ChecklistSheet({
  groupId,
  choreId,
  checklist,
  open,
  onOpenChange,
}: {
  groupId: string;
  choreId: string;
  checklist: ChoreChecklistItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Checklist</SheetTitle>
          <SheetDescription>Reviewers tick each item when checking a turn.</SheetDescription>
        </SheetHeader>
        {open && (
          <ChecklistForm
            groupId={groupId}
            choreId={choreId}
            checklist={checklist}
            onDone={() => onOpenChange(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function ChecklistForm({
  groupId,
  choreId,
  checklist,
  onDone,
}: {
  groupId: string;
  choreId: string;
  checklist: ChoreChecklistItem[];
  onDone: () => void;
}) {
  const replace = useReplaceChecklist(groupId, choreId);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<ChecklistFormValues>({
    resolver: zodResolver(checklistFormSchema),
    defaultValues: { items: checklist.map(({ id, label }) => ({ id, label })) },
  });
  // keyName: keep react-hook-form's own key off our `id` field
  const items = useFieldArray({ control, name: "items", keyName: "key" });

  const onSubmit = (v: ChecklistFormValues) => replace.mutate(v.items, { onSuccess: onDone });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 px-4 pb-4" noValidate>
      {items.fields.length === 0 && (
        <p className="text-sm text-muted-foreground">No items — reviews will just approve or reject.</p>
      )}
      {items.fields.map((field, i) => (
        <div key={field.key} className="flex items-center gap-1">
          <Input
            aria-label={`Item ${i + 1}`}
            aria-invalid={!!errors.items?.[i]?.label}
            {...register(`items.${i}.label`)}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Move up"
            disabled={i === 0}
            onClick={() => items.move(i, i - 1)}
          >
            <ArrowUp />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Move down"
            disabled={i === items.fields.length - 1}
            onClick={() => items.move(i, i + 1)}
          >
            <ArrowDown />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Remove item"
            onClick={() => items.remove(i)}
          >
            <X />
          </Button>
        </div>
      ))}
      {errors.items?.some?.((e) => e?.label) && (
        <p className="text-sm text-destructive">Every item needs a label (max 200 characters)</p>
      )}
      {items.fields.length < 30 && (
        <Button type="button" variant="outline" size="sm" onClick={() => items.append({ label: "" })}>
          <Plus /> Add item
        </Button>
      )}
      <Button type="submit" className="w-full" disabled={replace.isPending || !isDirty}>
        {replace.isPending ? "Saving…" : "Save checklist"}
      </Button>
    </form>
  );
}
