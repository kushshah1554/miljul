import { Link } from "react-router-dom";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/features/auth/authStore";

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-6 md:px-6 md:py-10">
      <section className="surface surface-glow space-y-4 p-8">
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome, {user?.name ?? "User"}!
        </h1>
        <p className="text-muted-foreground">
          Dashboard coming soon — you are logged in as{" "}
          <span className="font-semibold text-foreground">{user?.email}</span>
        </p>
        <Button size="lg" asChild>
          <Link to="/groups">
            <Users /> Your groups
          </Link>
        </Button>
      </section>
    </div>
  );
}
