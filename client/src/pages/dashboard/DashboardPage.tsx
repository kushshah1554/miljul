import { useAuthStore } from "@/features/auth/authStore";

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-8">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-foreground">
          Welcome, {user?.name ?? "User"}!
        </h1>
        <p className="text-muted-foreground">
          Dashboard coming soon — you are logged in as{" "}
          <span className="text-primary font-medium">{user?.email}</span>
        </p>
      
      </div>
    </div>
  );
}
