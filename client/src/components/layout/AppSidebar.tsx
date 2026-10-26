import { Fragment, useState } from "react";
import { NavLink, useMatch } from "react-router-dom";
import {
  ArrowLeft,
  House,
  LayoutDashboard,
  LogOut,
  Menu,
  Mountain,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  Scale,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { useAuthStore } from "@/features/auth/authStore";
import { useLogout } from "@/features/auth/useAuth";
import { useGroup, useGroups } from "@/features/group/useGroups";
import { isOwner } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./ThemeToggle";

interface NavItem {
  title: string;
  to: string;
  icon?: LucideIcon;
  /** Shown in a circle instead of an icon (group shortcuts) */
  initial?: string;
}

interface NavSections {
  back?: NavItem;
  heading?: string;
  items: NavItem[];
  shortcuts: NavItem[];
}

/** Inside a group the nav switches to that group's own menu. */
function useNavSections(): NavSections {
  const groupId = useMatch("/groups/:groupId/*")?.params.groupId;
  const { data: groups } = useGroups("active");
  const { data: group } = useGroup(groupId ?? "");

  if (!groupId) {
    return {
      items: [
        { title: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
        { title: "Groups", to: "/groups", icon: Users },
      ],
      shortcuts: (groups ?? []).map((g) => ({
        title: g.name,
        to: `/groups/${g.id}`,
        initial: g.name.charAt(0).toUpperCase(),
      })),
    };
  }

  const base = `/groups/${groupId}`;
  return {
    back: { title: "All groups", to: "/groups", icon: ArrowLeft },
    heading: group?.name,
    items: [
      { title: "Overview", to: base, icon: House },
      { title: "Expenses", to: `${base}/expenses`, icon: Receipt },
      { title: "Balances", to: `${base}/balances`, icon: Scale },
      { title: "Members", to: `${base}/members`, icon: Users },
      // Settings (join code, edit, archive) are owner-only
      ...(group && isOwner(group.role)
        ? [{ title: "Settings", to: `${base}/settings`, icon: Settings }]
        : []),
    ],
    shortcuts: [],
  };
}

function Logo({ withName }: { withName?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <Mountain className="size-8 stroke-[2.25]" />
      {withName && <span className="text-lg font-bold tracking-tight">Miljul</span>}
    </span>
  );
}

function ItemGlyph({ item }: { item: NavItem }) {
  return item.icon ? (
    <item.icon className="size-5" />
  ) : (
    <span className="grid size-9 place-items-center rounded-full bg-card text-sm font-semibold">
      {item.initial}
    </span>
  );
}

// ─── Desktop: collapsible rail ────────────────────────────────────────────────
// Every row is a fixed 56px icon box + a label, left-aligned. Collapsing only
// animates the rail's width and fades the labels, so nothing jumps around.
const EXPANDED_KEY = "sidebar-expanded";
const EASE = "duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none";

function readExpanded() {
  try {
    return localStorage.getItem(EXPANDED_KEY) === "true";
  } catch {
    return false;
  }
}

function Label({ expanded, children }: { expanded: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "truncate whitespace-nowrap transition-opacity",
        EASE,
        expanded ? "opacity-100 delay-100" : "opacity-0",
      )}
    >
      {children}
    </span>
  );
}

function RailLink({ item, expanded }: { item: NavItem; expanded: boolean }) {
  return (
    // Close on trigger leave: while expanded there is no content to leave, so hovers would stay "open"
    <Tooltip disableHoverableContent>
      <TooltipTrigger asChild>
        <NavLink
          to={item.to}
          end
          aria-label={expanded ? undefined : item.title}
          // Plain string, not NavLink's className function: TooltipTrigger's Slot
          // would stringify a function. NavLink marks the active link with aria-current.
          className="flex h-14 w-full shrink-0 items-center overflow-hidden rounded-2xl pr-3 text-sm font-medium text-foreground/75 transition-colors hover:bg-muted hover:text-foreground aria-[current=page]:bg-muted aria-[current=page]:text-foreground aria-[current=page]:shadow-[0_8px_20px_-10px_rgb(0_0_0/0.35)]"
        >
          <span className="grid size-14 shrink-0 place-items-center">
            <ItemGlyph item={item} />
          </span>
          <Label expanded={expanded}>{item.title}</Label>
        </NavLink>
      </TooltipTrigger>
      {/* Labels are visible when expanded, so tooltips only help the icon rail */}
      {!expanded && <TooltipContent side="right">{item.title}</TooltipContent>}
    </Tooltip>
  );
}

/** Short line between icons; folds away when labels make it unnecessary. */
function Divider({ expanded }: { expanded: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "ml-4 h-px shrink-0 bg-border transition-all",
        EASE,
        expanded ? "my-0.5 w-6 opacity-0" : "my-2 w-6 opacity-100",
      )}
    />
  );
}

/** Longer line between sections; stretches to full width when expanded. */
function SectionLine({ expanded }: { expanded: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "my-3 h-px shrink-0 bg-border transition-all",
        EASE,
        expanded ? "ml-0 w-full" : "ml-2 w-10",
      )}
    />
  );
}

export function AppSidebar() {
  const { back, items, shortcuts } = useNavSections();
  const [expanded, setExpanded] = useState(readExpanded);

  const toggle = () => {
    setExpanded((open) => {
      try {
        localStorage.setItem(EXPANDED_KEY, String(!open));
      } catch {
        // storage unavailable (private mode) — state just won't persist
      }
      return !open;
    });
  };

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-svh shrink-0 flex-col overflow-hidden px-5 py-8 transition-[width] md:top-5 md:flex md:h-[calc(100svh-2.5rem)]",
        EASE,
        expanded ? "w-64" : "w-24",
      )}
    >
      {/* ChatGPT-style: the logo is the toggle; on hover it hints at the action */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={toggle}
            aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
            aria-expanded={expanded}
            className="group/logo flex h-14 w-full shrink-0 items-center overflow-hidden rounded-2xl pr-3 transition-colors hover:bg-muted"
          >
            <span className="relative grid size-14 shrink-0 place-items-center">
              <Mountain className="size-8 stroke-[2.25] transition-opacity duration-200 group-hover/logo:opacity-0" />
              {expanded ? (
                <PanelLeftClose className="absolute size-5 opacity-0 transition-opacity duration-200 group-hover/logo:opacity-100" />
              ) : (
                <PanelLeftOpen className="absolute size-5 opacity-0 transition-opacity duration-200 group-hover/logo:opacity-100" />
              )}
            </span>
            <Label expanded={expanded}>
              <span className="text-lg font-bold tracking-tight">Miljul</span>
            </Label>
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">{expanded ? "Collapse" : "Expand"}</TooltipContent>
      </Tooltip>

      <nav className="no-scrollbar flex min-h-0 flex-1 flex-col justify-center overflow-x-hidden overflow-y-auto py-6">
        {back && (
          <>
            <RailLink item={back} expanded={expanded} />
            <SectionLine expanded={expanded} />
          </>
        )}
        {items.map((item, i) => (
          <Fragment key={item.to}>
            {i > 0 && <Divider expanded={expanded} />}
            <RailLink item={item} expanded={expanded} />
          </Fragment>
        ))}
        {shortcuts.length > 0 && (
          <>
            <SectionLine expanded={expanded} />
            {shortcuts.map((item) => (
              <RailLink key={item.to} item={item} expanded={expanded} />
            ))}
          </>
        )}
      </nav>

      <div className="flex flex-col gap-3">
        <span className="grid size-14 place-items-center">
          <ThemeToggle />
        </span>
        <UserMenu side="right" expanded={expanded} />
      </div>
    </aside>
  );
}

function UserMenu({ side, expanded }: { side: "right" | "bottom"; expanded?: boolean }) {
  const user = useAuthStore((s) => s.user);
  const { mutate: handleLogout, isPending } = useLogout();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className={cn(
            "flex items-center overflow-hidden rounded-full text-left",
            expanded !== undefined && "h-14 w-full rounded-2xl pr-3 transition-colors hover:bg-muted",
          )}
        >
          <span className={cn("grid shrink-0 place-items-center", expanded !== undefined && "size-14")}>
            <Avatar className="size-12">
              <AvatarFallback className="bg-primary text-base font-semibold text-primary-foreground">
                {user?.name.charAt(0).toUpperCase() ?? "?"}
              </AvatarFallback>
            </Avatar>
          </span>
          {expanded !== undefined && (
            <Label expanded={expanded}>
              <span className="block truncate text-sm font-semibold">{user?.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{user?.email}</span>
            </Label>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side={side} align="end" className="min-w-56">
        <DropdownMenuLabel className="grid">
          <span className="truncate font-semibold">{user?.name}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">{user?.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={isPending} onSelect={() => handleLogout()}>
          <LogOut /> {isPending ? "Logging out…" : "Log out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Mobile: top bar + slide-out menu with labels ────────────────────────────
function SheetLink({ item, onNavigate }: { item: NavItem; onNavigate: () => void }) {
  return (
    <NavLink
      to={item.to}
      end
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "flex h-12 items-center gap-3 rounded-2xl px-3 text-sm font-medium transition-colors hover:bg-muted",
          isActive && "bg-muted shadow-[0_8px_20px_-12px_rgb(0_0_0/0.35)]",
        )
      }
    >
      <ItemGlyph item={item} />
      <span className="truncate">{item.title}</span>
    </NavLink>
  );
}

export function MobileHeader() {
  const [open, setOpen] = useState(false);
  const { back, heading, items, shortcuts } = useNavSections();
  const close = () => setOpen(false);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-2 bg-background/85 px-4 backdrop-blur md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Open menu">
            <Menu />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 gap-1 rounded-r-4xl p-4">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="mb-4 px-2 pt-1">
            <Logo withName />
          </div>
          {back && <SheetLink item={back} onNavigate={close} />}
          {heading && (
            <p className="truncate px-3 pt-3 pb-1 text-xs font-semibold text-muted-foreground uppercase">
              {heading}
            </p>
          )}
          {items.map((item) => (
            <SheetLink key={item.to} item={item} onNavigate={close} />
          ))}
          {shortcuts.length > 0 && (
            <>
              <p className="px-3 pt-4 pb-1 text-xs font-semibold text-muted-foreground uppercase">
                Your groups
              </p>
              <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
                {shortcuts.map((item) => (
                  <SheetLink key={item.to} item={item} onNavigate={close} />
                ))}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Logo withName />
      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        <UserMenu side="bottom" />
      </div>
    </header>
  );
}
