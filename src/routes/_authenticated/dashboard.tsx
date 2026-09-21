import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "لوحة التحكم | Peniatahtia" },
      { name: "description", content: "لوحة التحكم الخاصة بحسابك." },
      { property: "og:title", content: "لوحة التحكم | Peniatahtia" },
      { property: "og:description", content: "لوحة التحكم الخاصة بحسابك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardPage,
});

const ROLE_LABELS: Record<string, string> = {
  admin: "مدير النظام",
  admin_staff: "موظف إشرافي",
  user: "مستخدم",
  user_staff: "موظف",
};

function DashboardPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, email, is_active")
        .eq("id", user.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: roles } = useQuery({
    queryKey: ["roles", user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      return data ?? [];
    },
  });

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">
            أهلًا {profile?.full_name || "بك"} 👋
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-card p-4 text-sm space-y-2">
            <p>
              <span className="font-medium">البريد الإلكتروني: </span>
              <span dir="ltr">{profile?.email ?? user.email}</span>
            </p>
            <p>
              <span className="font-medium">الدور: </span>
              {roles && roles.length > 0
                ? roles.map((r) => ROLE_LABELS[r.role] ?? r.role).join("، ")
                : "بدون دور"}
            </p>
          </div>
          <Button variant="outline" className="w-full" onClick={handleSignOut}>
            تسجيل الخروج
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
