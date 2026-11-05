import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/** A user's profile picture, or their initial when they have none. */
export function UserAvatar({
  user,
  className,
  fallbackClassName,
}: {
  user?: { name: string; profileUrl?: string | null } | null;
  className?: string;
  fallbackClassName?: string;
}) {
  return (
    <Avatar className={cn("size-11", className)}>
      {/* Google's image host can refuse requests that send a referrer */}
      <AvatarImage src={user?.profileUrl ?? undefined} alt="" referrerPolicy="no-referrer" />
      <AvatarFallback className={cn("bg-background font-semibold", fallbackClassName)}>
        {user?.name.charAt(0).toUpperCase() ?? "?"}
      </AvatarFallback>
    </Avatar>
  );
}
