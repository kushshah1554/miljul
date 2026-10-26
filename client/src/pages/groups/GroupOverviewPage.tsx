import { CalendarDays, Users } from "lucide-react";
import { useCurrentGroup } from "@/pages/groups/GroupLayout";

export default function GroupOverviewPage() {
  const group = useCurrentGroup();

  return (
    <section className="rounded-xl border border-border p-4 space-y-3">
      <h2 className="font-semibold">About</h2>
      <p className="text-muted-foreground">{group.description || "No description."}</p>
      <p className="flex items-center gap-1 text-sm text-muted-foreground">
        <Users className="size-4" /> {group.memberCount} member
        {group.memberCount === 1 ? "" : "s"}
      </p>
      <p className="flex items-center gap-1 text-sm text-muted-foreground">
        <CalendarDays className="size-4" /> Created{" "}
        {new Date(group.createdAt).toLocaleDateString()}
      </p>
    </section>
  );
}
