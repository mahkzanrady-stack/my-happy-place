import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { BENEFICIARY_KINDS } from "@/lib/dafter";

export const Route = createFileRoute("/_authenticated/beneficiaries")({
  head: () => ({
    meta: [
      { title: "المستفيدين | dafter" },
      { name: "description", content: "إدارة المستفيدين: موردين، شركات شحن، موظفين، وأي جهة." },
      { property: "og:title", content: "المستفيدين | dafter" },
      { property: "og:description", content: "إدارة المستفيدين: موردين، شركات شحن، موظفين، وأي جهة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BeneficiariesPage,
});

type Kind = keyof typeof BENEFICIARY_KINDS;

type BeneficiaryRow = {
  id: string;
  name: string;
  kind: Kind;
  phone: string | null;
  notes: string | null;
  is_active: boolean;
};

function BeneficiariesPage() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BeneficiaryRow | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<Kind>("other");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const { data: rows } = useQuery({
    queryKey: ["beneficiaries", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("beneficiaries")
        .select("id, name, kind, phone, notes, is_active")
        .order("name");
      if (error) throw error;
      return (data ?? []) as BeneficiaryRow[];
    },
  });

  const filtered = (rows ?? []).filter((b) => {
    if (!search.trim()) return true;
    const q = search.trim();
    return `${b.name} ${b.phone ?? ""} ${BENEFICIARY_KINDS[b.kind]}`.includes(q);
  });

  function openAdd() {
    setEditing(null);
    setName("");
    setKind("other");
    setPhone("");
    setNotes("");
    setOpen(true);
  }

  function openEdit(b: BeneficiaryRow) {
    setEditing(b);
    setName(b.name);
    setKind(b.kind);
    setPhone(b.phone ?? "");
    setNotes(b.notes ?? "");
    setOpen(true);
  }

  async function save() {
    if (!name.trim()) {
      toast.error("اكتب اسم المستفيد");
      return;
    }
    setSaving(true);
    if (editing) {
      const { error } = await supabase
        .from("beneficiaries")
        .update({ name: name.trim(), kind, phone: phone.trim() || null, notes: notes.trim() || null })
        .eq("id", editing.id);
      setSaving(false);
      if (error) {
        toast.error("حصلت مشكلة أثناء التعديل");
        return;
      }
      toast.success("اتعدل المستفيد");
    } else {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setSaving(false);
        return;
      }
      const { error } = await supabase.from("beneficiaries").insert({
        user_id: userData.user.id,
        name: name.trim(),
        kind,
        phone: phone.trim() || null,
        notes: notes.trim() || null,
      });
      setSaving(false);
      if (error) {
        toast.error("حصلت مشكلة أثناء الإضافة");
        return;
      }
      toast.success("اتضاف المستفيد");
    }
    setOpen(false);
    await queryClient.invalidateQueries({ queryKey: ["beneficiaries"] });
  }

  async function remove(b: BeneficiaryRow) {
    const { error } = await supabase.from("beneficiaries").delete().eq("id", b.id);
    if (error) {
      // القيود: المستفيد مرتبط بعمليات — نعطّله بدل الحذف حفاظًا على التاريخ
      if (error.code === "23503") {
        toast.error("مينفعش يتحذف لأن ليه عمليات مسجلة. تقدر توقفه بدل الحذف.");
      } else {
        toast.error("حصلت مشكلة أثناء الحذف");
      }
      return;
    }
    toast.success("اتحذف المستفيد");
    await queryClient.invalidateQueries({ queryKey: ["beneficiaries"] });
  }

  async function toggleActive(b: BeneficiaryRow) {
    const { error } = await supabase
      .from("beneficiaries")
      .update({ is_active: !b.is_active })
      .eq("id", b.id);
    if (error) {
      toast.error("حصلت مشكلة");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["beneficiaries"] });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">المستفيدين</h2>
        <Button onClick={openAdd}>
          <Plus className="ml-2 h-4 w-4" />
          مستفيد جديد
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pr-9"
          placeholder="ابحث بالاسم أو التليفون أو النوع..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              لا يوجد مستفيدين — اضغط «مستفيد جديد» للبدء
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الاسم</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>التليفون</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.name}</TableCell>
                    <TableCell>{BENEFICIARY_KINDS[b.kind]}</TableCell>
                    <TableCell dir="ltr" className="text-right">{b.phone ?? "—"}</TableCell>
                    <TableCell>
                      <button
                        onClick={() => toggleActive(b)}
                        className={b.is_active ? "text-chart-2 text-sm" : "text-muted-foreground text-sm"}
                      >
                        {b.is_active ? "فعّال" : "موقوف"}
                      </button>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(b)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => remove(b)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "تعديل مستفيد" : "مستفيد جديد"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>الاسم</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>النوع</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as Kind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(BENEFICIARY_KINDS).map(([k, label]) => (
                    <SelectItem key={k} value={k}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>التليفون (اختياري)</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" className="text-left" />
            </div>
            <div className="space-y-1.5">
              <Label>ملاحظات (اختياري)</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
            <Button className="w-full" onClick={save} disabled={saving}>
              {saving ? "بيحفظ..." : editing ? "احفظ التعديل" : "إضافة"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
