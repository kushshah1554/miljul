import * as React from "react"
import { cn } from "cn"
import { CalendarIcon, ClockIcon } from "lucide-react"

const PICKERS = {
  time: { Icon: ClockIcon, placeholder: "--:--" },
  "datetime-local": { Icon: CalendarIcon, placeholder: "Date and time" },
}

/** Touch browsers draw nothing in an empty native picker, so overlay our own placeholder and icon there. */
function PickerInput({
  type,
  className,
  onChange,
  ...props
}: React.ComponentProps<"input"> & { type: keyof typeof PICKERS }) {
  // shortcut: uncontrolled fields count as filled until edited, track the DOM value if one starts empty
  const [cleared, setCleared] = React.useState(false)
  const empty = props.value === undefined ? cleared : props.value === ""
  const { Icon, placeholder } = PICKERS[type]

  return (
    <div className="relative">
      <BaseInput
        type={type}
        data-empty={empty || undefined}
        className={cn("pointer-coarse:pr-10", className)}
        onChange={(e) => {
          setCleared(e.target.value === "")
          onChange?.(e)
        }}
        {...props}
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 hidden text-muted-foreground pointer-coarse:block">
        {empty && <span className="absolute top-1/2 left-3 -translate-y-1/2 text-base">{placeholder}</span>}
        <Icon className="absolute top-1/2 right-3 size-4 -translate-y-1/2" />
      </div>
    </div>
  )
}

function Input({ type, ...props }: React.ComponentProps<"input">) {
  return type === "time" || type === "datetime-local" ? (
    <PickerInput type={type as keyof typeof PICKERS} {...props} />
  ) : (
    <BaseInput type={type} {...props} />
  )
}

function BaseInput({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-xl border border-input bg-background px-3 py-1 shadow-xs text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:pointer-fine:text-sm dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
