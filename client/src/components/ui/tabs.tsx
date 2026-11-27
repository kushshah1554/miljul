import * as React from "react"
import { cn } from "cn"
import type { LucideIcon } from "lucide-react"
import { Tabs as TabsPrimitive } from "radix-ui"

type TabItem<T extends string = string> = { value: T; label: string; icon?: LucideIcon }

const TabsContext = React.createContext<{
  items: readonly TabItem[]
  value: string
  forward: boolean
}>({ items: [], value: "", forward: true })

/** Controlled tabs: put a TabsList and either TabsContent per tab or one TabsPanels inside. */
function Tabs<T extends string>({
  items,
  value,
  onValueChange,
  className,
  children,
}: {
  items: readonly TabItem<T>[]
  value: T
  onValueChange: (value: T) => void
  className?: string
  children: React.ReactNode
}) {
  const index = items.findIndex((item) => item.value === value)
  const [nav, setNav] = React.useState({ index, forward: true })
  if (nav.index !== index) setNav({ index, forward: index > nav.index })

  return (
    <TabsContext value={{ items, value, forward: nav.forward }}>
      <TabsPrimitive.Root
        value={value}
        onValueChange={(next) => onValueChange(next as T)}
        className={className}
      >
        {children}
      </TabsPrimitive.Root>
    </TabsContext>
  )
}

/** Pill bar; scrolls sideways when the tabs don't fit. */
function TabsList({ label, className }: { label: string; className?: string }) {
  const { items, value } = React.useContext(TabsContext)
  const listRef = React.useRef<HTMLDivElement>(null)
  const pillRef = React.useRef<HTMLSpanElement>(null)

  React.useLayoutEffect(() => {
    const list = listRef.current
    const pill = pillRef.current
    const active = list?.querySelector<HTMLElement>('[data-state="active"]')
    if (!list || !pill || !active) return

    const place = () => {
      pill.style.width = `${active.offsetWidth}px`
      pill.style.transform = `translateX(${active.offsetLeft}px)`
      pill.style.display = "block" // hidden until placed, so it doesn't fly in on first render
    }
    place()
    list.scrollTo({ left: active.offsetLeft - (list.clientWidth - active.offsetWidth) / 2 })

    const observer = new ResizeObserver(place)
    observer.observe(list)
    for (const trigger of list.querySelectorAll('[role="tab"]')) observer.observe(trigger)
    return () => observer.disconnect()
  }, [value, items.length])

  return (
    <TabsPrimitive.List
      ref={listRef}
      aria-label={label}
      className={cn(
        "relative flex w-fit max-w-full overflow-x-auto scroll-smooth rounded-full bg-card p-1 [scrollbar-width:none] motion-reduce:scroll-auto",
        className
      )}
    >
      <span
        ref={pillRef}
        aria-hidden
        className="absolute inset-y-1 left-0 hidden rounded-full bg-primary transition-[transform,width] duration-300 ease-out motion-reduce:transition-none"
      />
      {items.map(({ value, label, icon: Icon }) => (
        <TabsPrimitive.Trigger
          key={value}
          value={value}
          className="relative flex h-9 shrink-0 grow items-center justify-center gap-1.5 rounded-full px-3 text-sm font-medium whitespace-nowrap text-muted-foreground outline-none transition-colors duration-300 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-[state=active]:text-primary-foreground sm:px-4"
        >
          {Icon && <Icon className="hidden size-4 sm:block" aria-hidden />} {label}
        </TabsPrimitive.Trigger>
      ))}
    </TabsPrimitive.List>
  )
}

/** Content of one tab; slides in from the side of the tab that was clicked. */
function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  const { forward } = React.useContext(TabsContext)
  return (
    <TabsPrimitive.Content
      className={cn(
        "animate-in rounded-3xl duration-300 ease-out outline-none fade-in focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:animate-none",
        forward ? "slide-in-from-right-4" : "slide-in-from-left-4",
        className
      )}
      {...props}
    />
  )
}

/** For tabs that filter one view: the same children for every tab, remounted on switch. */
function TabsPanels({ className, children }: { className?: string; children: React.ReactNode }) {
  const { items } = React.useContext(TabsContext)
  return (
    <div>
      {items.map(({ value }) => (
        <TabsContent key={value} value={value} className={className}>
          {children}
        </TabsContent>
      ))}
    </div>
  )
}

export { Tabs, TabsContent, TabsList, TabsPanels }
