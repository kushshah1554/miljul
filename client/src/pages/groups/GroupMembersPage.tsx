import { MembersCard } from "@/components/group/MembersCard";
import { useCurrentGroup } from "@/pages/groups/GroupLayout";

export default function GroupMembersPage() {
  return <MembersCard group={useCurrentGroup()} />;
}
