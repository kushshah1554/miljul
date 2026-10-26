import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

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
import type { CreateExpenseBody } from "@/features/expense/expense.api";
import { expenseFormSchema, type ExpenseFormValues } from "@/features/expense/expense.schema";
import { useCreateExpense, useUpdateExpense } from "@/features/expense/useExpenses";
import { useMembers } from "@/features/member/useMembers";
import { fromCents, splitEqually, toCents } from "@/lib/money";
import type { ExpenseDetail, GroupMemberRecord } from "@/lib/types";

/** Add a new expense, or edit `expense` when given (owner only on the server). */
export function ExpenseFormSheet({
  groupId,
  open,
  onOpenChange,
  expense,
}: {
  groupId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense?: ExpenseDetail;
}) {
  const { data: members, isPending, isError, error } = useMembers(groupId);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{expense ? "Edit expense" : "Add expense"}</SheetTitle>
          <SheetDescription>Amounts are split between the people you tick.</SheetDescription>
        </SheetHeader>

        {isPending && (
          <div className="space-y-2 px-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        )}
        {isError && <p className="px-4 text-sm text-destructive">{error.message}</p>}
        {/* Mount the form only while open so it starts fresh every time */}
        {open && members && (
          <ExpenseForm
            groupId={groupId}
            members={members}
            expense={expense}
            onDone={() => onOpenChange(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function defaultValues(
  members: GroupMemberRecord[],
  myUserId: string,
  expense?: ExpenseDetail,
): ExpenseFormValues {
  if (!expense) {
    return {
      description: "",
      amount: "",
      paidById: myUserId,
      splitMode: "equal",
      splits: members.map((m) => ({ userId: m.userId, included: true, amount: "" })),
    };
  }

  const byUser = new Map(expense.splits.map((s) => [s.userId, s.amount]));
  const shares = expense.splits.map((s) => toCents(s.amount));
  const equal = splitEqually(toCents(expense.amount), shares.length);
  // Only call it "equal" if it matches exactly what an equal split would produce
  const isEqual = [...shares].sort().join() === [...equal].sort().join();

  return {
    description: expense.description,
    amount: expense.amount,
    paidById: expense.paidById,
    splitMode: isEqual ? "equal" : "custom",
    splits: members.map((m) => ({
      userId: m.userId,
      included: byUser.has(m.userId),
      amount: byUser.get(m.userId) ?? "",
    })),
  };
}

function toBody(v: ExpenseFormValues): CreateExpenseBody {
  const included = v.splits.filter((s) => s.included);
  const equal = splitEqually(toCents(v.amount), included.length);
  return {
    description: v.description,
    amount: v.amount,
    paidById: v.paidById,
    splits: included.map((s, i) => ({
      userId: s.userId,
      amount: v.splitMode === "equal" ? fromCents(equal[i]) : s.amount.trim(),
    })),
  };
}

function ExpenseForm({
  groupId,
  members,
  expense,
  onDone,
}: {
  groupId: string;
  members: GroupMemberRecord[];
  expense?: ExpenseDetail;
  onDone: () => void;
}) {
  const myUserId = useAuthStore((s) => s.user?.id ?? "");
  const create = useCreateExpense(groupId);
  const update = useUpdateExpense(groupId);
  const isSaving = create.isPending || update.isPending;

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: defaultValues(members, myUserId, expense),
  });

  const splitMode = useWatch({ control, name: "splitMode" });
  const amount = useWatch({ control, name: "amount" });
  const splits = useWatch({ control, name: "splits" });

  // Live preview of each person's share in equal mode
  const includedCount = splits.filter((s) => s.included).length;
  const equalShares =
    includedCount > 0 && Number(amount) > 0
      ? splitEqually(toCents(amount), includedCount)
      : [];
  let shareIndex = 0;

  const onSubmit = (values: ExpenseFormValues) => {
    const body = toBody(values);
    if (expense) {
      update.mutate({ expenseId: expense.id, ...body }, { onSuccess: onDone });
    } else {
      create.mutate(body, { onSuccess: onDone });
    }
  };

  const splitsError = errors.splits?.message ?? errors.splits?.root?.message;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 px-4 pb-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="expense-description">Description</Label>
        <Input
          id="expense-description"
          placeholder="Dinner, rent, groceries…"
          aria-invalid={!!errors.description}
          {...register("description")}
        />
        {errors.description && (
          <p className="text-sm text-destructive">{errors.description.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="expense-amount">Amount</Label>
        <Input
          id="expense-amount"
          inputMode="decimal"
          placeholder="0.00"
          aria-invalid={!!errors.amount}
          {...register("amount")}
        />
        {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="expense-paid-by">Paid by</Label>
        <select
          id="expense-paid-by"
          className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          {...register("paidById")}
        >
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.user.name}
              {m.userId === myUserId ? " (you)" : ""}
            </option>
          ))}
        </select>
        {errors.paidById && (
          <p className="text-sm text-destructive">{errors.paidById.message}</p>
        )}
      </div>

      <fieldset className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <legend className="text-sm font-medium">Split</legend>
          <Controller
            control={control}
            name="splitMode"
            render={({ field }) => (
              <div className="flex gap-1">
                {(["equal", "custom"] as const).map((mode) => (
                  <Button
                    key={mode}
                    type="button"
                    size="sm"
                    variant={field.value === mode ? "default" : "outline"}
                    onClick={() => field.onChange(mode)}
                    className="capitalize"
                  >
                    {mode === "equal" ? "Equally" : "Custom"}
                  </Button>
                ))}
              </div>
            )}
          />
        </div>

        <ul className="space-y-2">
          {members.map((m, i) => {
            const included = splits[i]?.included;
            const share = included ? equalShares[shareIndex++] : undefined;
            return (
              <li key={m.userId} className="flex items-center gap-3">
                <Controller
                  control={control}
                  name={`splits.${i}.included`}
                  render={({ field }) => (
                    <Checkbox
                      id={`split-${m.userId}`}
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                    />
                  )}
                />
                <Label htmlFor={`split-${m.userId}`} className="min-w-0 flex-1 truncate font-normal">
                  {m.user.name}
                  {m.userId === myUserId ? " (you)" : ""}
                </Label>
                {splitMode === "custom" ? (
                  <Input
                    className="w-28"
                    inputMode="decimal"
                    placeholder="0.00"
                    disabled={!included}
                    aria-label={`${m.user.name}'s share`}
                    aria-invalid={!!errors.splits?.[i]?.amount}
                    {...register(`splits.${i}.amount`)}
                  />
                ) : (
                  <span className="w-28 text-right font-mono text-sm text-muted-foreground">
                    {share !== undefined ? fromCents(share) : "—"}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        {splitsError && <p className="text-sm text-destructive">{splitsError}</p>}
      </fieldset>

      <Button type="submit" className="w-full" disabled={isSaving}>
        {isSaving ? "Saving…" : expense ? "Save changes" : "Add expense"}
      </Button>
    </form>
  );
}
