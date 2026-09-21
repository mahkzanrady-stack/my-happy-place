import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Peniatahtia | الصفحة الرئيسية" },
      { name: "description", content: "سجّل الدخول أو أنشئ حسابًا جديدًا للبدء." },
      { property: "og:title", content: "Peniatahtia" },
      { property: "og:description", content: "سجّل الدخول أو أنشئ حسابًا جديدًا للبدء." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <h1 className="text-4xl font-bold text-foreground">Peniatahtia</h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        مرحبًا بك! سجّل الدخول إلى حسابك أو أنشئ حسابًا جديدًا للبدء.
      </p>
      <div className="mt-8 flex gap-3">
        <Button asChild>
          <Link to="/auth">تسجيل الدخول</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/auth">إنشاء حساب</Link>
        </Button>
      </div>
    </div>
  );
}
