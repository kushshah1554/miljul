import { Crown, LogOut, MoreHorizontal, UserMinus } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useAuthStore } from "@/features/auth/authStore";
import {
  useLeaveGroup,
  useMembers,
  useRemoveMember,
  useTransferOwnership,
} from "@/features/member/useMembers";
import { isOwner } from "@/lib/roles";
import type { Group, GroupMemberRecord } from "@/lib/types";

export function MembersCard({ group }: { group: Group }) {
  const myUserId = useAuthStore((s) => s.user?.id ?? "");
  const { data: members, isPending, isError, error } = useMembers(group.id);
  const leave = useLeaveGroup(group.id, myUserId);

  const handleLeave = () => {
    if (window.confirm(`Leave "${group.name}"? Your expense history stays in the group.`)) {
      leave.mutate();
    }
  };

  return (
    <section className="rounded-xl border border-border p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">Members</h2>
        <Button variant="ghost" size="sm" onClick={handleLeave} disabled={leave.isPending}>
          <LogOut /> {leave.isPending ? "Leaving…" : "Leave group"}
        </Button>
      </div>

      {isPending && (
        <div className="space-y-2">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      )}
      {isError && <p className="text-sm text-destructive">{error.message}</p>}

      <ul className="divide-y divide-border">
        {members?.map((member) => (
          <MemberRow
            key={member.id}
            group={group}
            member={member}
            isMe={member.userId === myUserId}
          />
        ))}
      </ul>
    </section>
  );
}

function MemberRow({
  group,
  member,
  isMe,
}: {
  group: Group;
  member: GroupMemberRecord;
  isMe: boolean;
}) {
  const remove = useRemoveMember(group.id);
  const transfer = useTransferOwnership(group.id);

  // Archived groups are read-only; only leaving is still allowed (header button)
  // Only owners act on others: remove or hand over ownership
  const showActions = !group.isArchived && !isMe && isOwner(group.role);
  const isBusy = remove.isPending || transfer.isPending;

  const handleRemove = () => {
    if (window.confirm(`Remove ${member.user.name} from the group?`)) {
      remove.mutate(member.userId);
    }
  };

  const handleTransfer = () => {
    if (
      window.confirm(
        `Make ${member.user.name} the owner? You will become a regular member.`,
      )
    ) {
      transfer.mutate(member.userId);
    }
  };

  return (
    <li className="flex items-center gap-3 py-3">
      <Avatar className="size-9">
        <AvatarFallback>{member.user.name.charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {member.user.name}
          {isMe && <span className="text-muted-foreground"> (you)</span>}
        </p>
        <p className="truncate text-xs text-muted-foreground">{member.user.email}</p>
      </div>
      <span className="flex shrink-0 items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
        {member.role === "OWNER" && <Crown className="size-3.5" />}
        {member.role}
      </span>

      {showActions && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={isBusy}
              aria-label={`Actions for ${member.user.name}`}
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={handleTransfer}>
              <Crown /> Make owner
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={handleRemove}>
              <UserMinus /> Remove from group
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </li>
  );
}
