import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Inline "why?" form shared by every chore action that takes a reason
 * (skip, waive, void, pause…). `children` adds extra fields above the buttons.
 */
export function ReasonForm({
  label = "Reason",
  placeholder,
  submitLabel,
  required = true,
  maxLength = 200,
  destructive,
  isPending,
  onSubmit,
  onCancel,
  children,
}: {
  label?: string;
  placeholder?: string;
  submitLabel: string;
  required?: boolean;
  maxLength?: number;
  destructive?: boolean;
  isPending: boolean;
  onSubmit: (reason: string | undefined) => void;
  onCancel: () => void;
  children?: React.ReactNode;
}) {
  const id = useId();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = reason.trim();
    if (required && !trimmed) return setError(`${label} is required`);
    if (trimmed.length > maxLength) return setError(`At most ${maxLength} characters`);
    onSubmit(trimmed || undefined);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl bg-background p-3" noValidate>
      <div className="space-y-2">
        <Label htmlFor={id}>
          {label}
          {!required && <span className="font-normal text-muted-foreground"> (optional)</span>}
        </Label>
        <Input
          id={id}
          autoFocus
          placeholder={placeholder}
          value={reason}
          aria-invalid={!!error}
          onChange={(e) => {
            setReason(e.target.value);
            setError(null);
          }}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      {children}
      <div className="flex gap-2">
        <Button
          type="submit"
          size="sm"
          variant={destructive ? "destructive" : "default"}
          disabled={isPending}
        >
          {isPending ? "Saving…" : submitLabel}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
