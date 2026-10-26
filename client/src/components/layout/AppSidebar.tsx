import { Link, useLocation, useMatch } from "react-router-dom";
import {
  ArrowLeft,
  ChevronsUpDown,
  House,
  LayoutDashboard,
  LogOut,
  Mountain,
  Receipt,
  Settings,
  Users,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";

import { useAuthStore } from "@/features/auth/authStore";
import { useLogout } from "@/features/auth/useAuth";
import { useGroup, useGroups } from "@/features/group/useGroups";
import { isOwner } from "@/lib/roles";

const NAV_ITEMS = [
  { title: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { title: "Groups", to: "/groups", icon: Users },
];

export function AppSidebar() {
  const { isMobile, setOpenMobile } = useSidebar();
  const user = useAuthStore((s) => s.user);
  const { mutate: handleLogout, isPending: isLoggingOut } = useLogout();
  // Inside a group the sidebar switches to that group's own menu
  const groupMatch = useMatch("/groups/:groupId/*");

  // On mobile the sidebar is a sheet — close it after picking a page
  const closeOnMobile = () => setOpenMobile(false);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/dashboard" onClick={closeOnMobile}>
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <Mountain className="size-4" />
                </div>
                <span className="text-lg font-bold tracking-tight">Miljul</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {groupMatch?.params.groupId ? (
        <GroupNav groupId={groupMatch.params.groupId} onNavigate={closeOnMobile} />
      ) : (
        <MainNav onNavigate={closeOnMobile} />
      )}

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent"
                >
                  <Avatar className="size-8 rounded-lg">
                    <AvatarFallback className="rounded-lg">
                      {user?.name.charAt(0).toUpperCase() ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{user?.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {user?.email}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side={isMobile ? "bottom" : "right"}
                align="end"
                className="min-w-56"
              >
                <DropdownMenuLabel className="truncate">
                  {user?.email}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={isLoggingOut}
                  onSelect={() => handleLogout()}
                >
                  <LogOut />
                  {isLoggingOut ? "Logging out…" : "Log out"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

function MainNav({ onNavigate }: { onNavigate: () => void }) {
  const { pathname } = useLocation();
  const { data: groups, isPending: groupsLoading } = useGroups("active");

  return (
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel>Menu</SidebarGroupLabel>
        <SidebarMenu>
          {NAV_ITEMS.map((item) => (
            <SidebarMenuItem key={item.to}>
              <SidebarMenuButton
                asChild
                isActive={pathname === item.to}
                tooltip={item.title}
              >
                <Link to={item.to} onClick={onNavigate}>
                  <item.icon />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroup>

      <SidebarGroup className="group-data-[collapsible=icon]:hidden">
        <SidebarGroupLabel>Your groups</SidebarGroupLabel>
        <SidebarMenu>
          {groupsLoading &&
            Array.from({ length: 3 }, (_, i) => (
              <SidebarMenuItem key={i}>
                <SidebarMenuSkeleton />
              </SidebarMenuItem>
            ))}
          {groups?.length === 0 && (
            <p className="px-2 text-xs text-muted-foreground">
              No active groups yet
            </p>
          )}
          {groups?.map((group) => (
            <SidebarMenuItem key={group.id}>
              <SidebarMenuButton
                asChild
                isActive={pathname.startsWith(`/groups/${group.id}`)}
              >
                <Link to={`/groups/${group.id}`} onClick={onNavigate}>
                  <span className="truncate">{group.name}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroup>
    </SidebarContent>
  );
}

function GroupNav({ groupId, onNavigate }: { groupId: string; onNavigate: () => void }) {
  const { pathname } = useLocation();
  const { data: group } = useGroup(groupId);
  const base = `/groups/${groupId}`;

  const items = [
    { title: "Overview", to: base, icon: House },
    { title: "Expenses", to: `${base}/expenses`, icon: Receipt },
    { title: "Members", to: `${base}/members`, icon: Users },
    // Settings (join code, edit, archive) are owner-only
    ...(group && isOwner(group.role)
      ? [{ title: "Settings", to: `${base}/settings`, icon: Settings }]
      : []),
  ];

  return (
    <SidebarContent>
      <SidebarGroup>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="All groups">
              <Link to="/groups" onClick={onNavigate}>
                <ArrowLeft />
                <span>All groups</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>

      <SidebarGroup>
        <SidebarGroupLabel className="truncate">
          {group?.name ?? "Loading…"}
        </SidebarGroupLabel>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.to}>
              <SidebarMenuButton asChild isActive={pathname === item.to} tooltip={item.title}>
                <Link to={item.to} onClick={onNavigate}>
                  <item.icon />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroup>
    </SidebarContent>
  );
}
