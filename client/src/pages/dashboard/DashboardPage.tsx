import { useAuthStore } from "@/store/authStore";
import { useLogout } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { mutate: handleLogout, isPending } = useLogout();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-foreground">
          Welcome, {user?.name ?? "User"}!
        </h1>
        <p className="text-muted-foreground">
          Dashboard coming soon — you are logged in as{" "}
          <span className="text-primary font-medium">{user?.email}</span>
        </p>
        <Button
          variant="outline"
          onClick={() => handleLogout()}
          disabled={isPending}
        >
          {isPending ? "Logging out…" : "Log out"}
        </Button>
      </div>
    </div>
  );
}
