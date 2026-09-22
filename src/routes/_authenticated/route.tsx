import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Home, Package, Banknote, Users, MessageSquare, LogOut } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

const NAV = [
  { to: "/dashboard", label: "نظرة عامة", icon: Home },
  { to: "/goods", label: "بضاعة", icon: Package },
  { to: "/money", label: "أموال", icon: Banknote },
  { to: "/beneficiaries", label: "المستفيدين", icon: Users },
  { to: "/chat", label: "Chat AI", icon: MessageSquare },
] as const;

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* القائمة الجانبية */}
      <aside className="flex w-56 shrink-0 flex-col border-l bg-card">
        <div className="border-b px-5 py-5">
          <h1 className="text-xl font-bold text-foreground">dafter</h1>
          <p className="text-xs text-muted-foreground">حسابات ومخازن ببساطة</p>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: true }}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              activeProps={{ className: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground" }}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t p-3">
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* المحتوى */}
      <main className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
