import * as React from "react"
import { cn } from "cn"
import { Popover } from "radix-ui"
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { DayPicker, type Matcher } from "react-day-picker"

import { Button, buttonVariants } from "@/components/ui/button"
import { dateToInput, inputToDate } from "@/lib/time"

const navButton = buttonVariants({ variant: "ghost", size: "icon-sm" })

/** Date field with the same string contract as `<input type="date">`: "YYYY-MM-DD", or "" when empty. */
function DatePicker({
  id,
  value,
  onChange,
  onBlur,
  min,
  max,
  placeholder = "mm/dd/yyyy",
  className,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  min?: string
  max?: string
  placeholder?: string
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const selected = value ? inputToDate(value) : undefined
  const minDate = min ? inputToDate(min) : undefined
  const maxDate = max ? inputToDate(max) : undefined
  const disabled: Matcher[] = []
  if (minDate) disabled.push({ before: minDate })
  if (maxDate) disabled.push({ after: maxDate })

  const pick = (next: string) => {
    onChange(next)
    setOpen(false)
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen} modal>
      <Popover.Trigger
        id={id}
        type="button"
        // The <label> replaces the button's text as its name, so expose the value separately
        aria-describedby={`${id}-value`}
        onBlur={onBlur}
        className={cn(
          "relative flex h-10 w-full min-w-0 items-center rounded-xl border border-input bg-background pr-10 pl-3 text-left text-base shadow-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:pointer-fine:text-sm",
          className
        )}
      >
        <span id={`${id}-value`} className={cn("truncate", !selected && "text-muted-foreground")}>
          {selected
            ? selected.toLocaleDateString(undefined, { year: "numeric", month: "2-digit", day: "2-digit" })
            : placeholder}
        </span>
        <CalendarIcon
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          aria-label="Choose date"
          align="start"
          sideOffset={6}
          collisionPadding={8}
          className="z-50 max-h-(--radix-popover-content-available-height) overflow-y-auto rounded-xl bg-popover p-3 text-popover-foreground shadow-lg ring-1 ring-foreground/10 outline-none duration-150 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
        >
          <DayPicker
            mode="single"
            required
            autoFocus
            selected={selected}
            onSelect={(date) => pick(dateToInput(date))}
            defaultMonth={selected ?? maxDate ?? minDate}
            disabled={disabled}
            classNames={{
              months: "relative",
              nav: "absolute inset-x-0 top-0 flex justify-between",
              button_previous: navButton,
              button_next: navButton,
              month_caption: "flex h-8 items-center justify-center text-sm font-medium",
              month_grid: "mt-2",
              weekday: "size-9 text-xs font-normal text-muted-foreground",
              day: "p-0",
              day_button:
                "size-9 rounded-full text-sm outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40",
              today: "font-extrabold text-success",
              selected: "[&>button]:bg-primary [&>button]:text-primary-foreground",
              hidden: "invisible",
            }}
            components={{
              Chevron: ({ orientation }) =>
                orientation === "left" ? <ChevronLeftIcon /> : <ChevronRightIcon />,
            }}
          />
          {value && (
            <Button type="button" variant="ghost" size="sm" className="mt-2 w-full" onClick={() => pick("")}>
              Clear
            </Button>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

export { DatePicker }
