import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, Search } from "lucide-react";
import {
  BENEFICIARY_KINDS,
  PERIOD_LABELS,
  fmtDate,
  fmtEGP,
  periodStart,
  type Period,
} from "@/lib/dafter";
import { toast } from "sonner";

type Beneficiary = {
  id: string;
  name: string;
  kind: keyof typeof BENEFICIARY_KINDS;
};

export function useBeneficiaries() {
  return useQuery({
    queryKey: ["beneficiaries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("beneficiaries")
        .select("id, name, kind")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Beneficiary[];
    },
  });
}

export function BeneficiaryPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const { data: beneficiaries } = useBeneficiaries();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<keyof typeof BENEFICIARY_KINDS>("other");
  const queryClient = useQueryClient();

  async function addBeneficiary() {
    if (!name.trim()) return;
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { data, error } = await supabase
      .from("beneficiaries")
      .insert({ name: name.trim(), kind, user_id: userData.user.id })
      .select("id")
      .single();
    if (error) {
      toast.error("حصلت مشكلة أثناء إضافة المستفيد");
      return;
    }
    toast.success("اتضاف المستفيد");
    setName("");
    setAdding(false);
    await queryClient.invalidateQueries({ queryKey: ["beneficiaries"] });
    if (data) onChange(data.id);
  }

  if (adding) {
    return (
      <div className="space-y-2 rounded-lg border p-3">
        <Input
          placeholder="اسم المستفيد"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <div className="flex gap-2">
          <Select value={kind} onValueChange={(v) => setKind(v as keyof typeof BENEFICIARY_KINDS)}>
            <SelectTrigger className="flex-1">
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
          <Button size="sm" onClick={addBeneficiary}>
            إضافة
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
            إلغاء
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="flex-1">
          <SelectValue placeholder="اختار المستفيد" />
        </SelectTrigger>
        <SelectContent>
          {(beneficiaries ?? []).map((b) => (
            <SelectItem key={b.id} value={b.id}>
              {b.name} — {BENEFICIARY_KINDS[b.kind]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="button" variant="outline" size="icon" onClick={() => setAdding(true)} title="مستفيد جديد">
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function MovementTypePicker({
  domain,
  value,
  onChange,
}: {
  domain: "goods" | "money";
  value: string;
  onChange: (id: string) => void;
}) {
  const { data: types } = useQuery({
    queryKey: ["movement_types", domain],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movement_types")
        .select("id, name")
        .eq("domain", domain)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const queryClient = useQueryClient();

  async function addType() {
    if (!name.trim()) return;
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { data, error } = await supabase
      .from("movement_types")
      .insert({ name: name.trim(), domain, user_id: userData.user.id })
      .select("id")
      .single();
    if (error) {
      toast.error(error.code === "23505" ? "النوع ده موجود قبل كده" : "حصلت مشكلة أثناء إضافة النوع");
      return;
    }
    toast.success("اتضاف النوع");
    setName("");
    setAdding(false);
    await queryClient.invalidateQueries({ queryKey: ["movement_types", domain] });
    if (data) onChange(data.id);
  }

  if (adding) {
    return (
      <div className="flex gap-2 rounded-lg border p-3">
        <Input
          placeholder="اسم النوع الجديد"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <Button size="sm" onClick={addType}>
          إضافة
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
          إلغاء
        </Button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="flex-1">
          <SelectValue placeholder="اختار النوع" />
        </SelectTrigger>
        <SelectContent>
          {(types ?? []).map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="button" variant="outline" size="icon" onClick={() => setAdding(true)} title="نوع جديد">
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}

export type TxRow = {
  id: string;
  direction: "in" | "out";
  amount: number;
  context: "personal" | "business";
  payment_type?: "cash" | "credit" | "partial" | null;
  paid_amount?: number | null;
  notes: string | null;
  occurred_at: string;
  type_name: string | null;
  beneficiary_name: string | null;
};

export function TxList({ rows, showPayment }: { rows: TxRow[]; showPayment?: boolean }) {
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<Period>("all");

  const start = periodStart(period);
  const filtered = rows.filter((r) => {
    if (start && new Date(r.occurred_at) < start) return false;
    if (search.trim()) {
      const q = search.trim();
      const hay = `${r.type_name ?? ""} ${r.beneficiary_name ?? ""} ${r.notes ?? ""} ${r.amount}`;
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pr-9"
            placeholder="ابحث بالاسم أو النوع أو المبلغ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PERIOD_LABELS).map(([k, label]) => (
              <SelectItem key={k} value={k}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">لا توجد عمليات</p>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>التاريخ</TableHead>
                <TableHead>الاتجاه</TableHead>
                <TableHead>النوع</TableHead>
                <TableHead>المستفيد</TableHead>
                <TableHead>شخصي/عمل</TableHead>
                {showPayment && <TableHead>الدفع</TableHead>}
                <TableHead className="text-left">القيمة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap">{fmtDate(r.occurred_at)}</TableCell>
                  <TableCell>
                    <span
                      className={
                        r.direction === "in"
                          ? "font-medium text-chart-2"
                          : "font-medium text-destructive"
                      }
                    >
                      {r.direction === "in" ? "داخل" : "خارج"}
                    </span>
                  </TableCell>
                  <TableCell>{r.type_name ?? "—"}</TableCell>
                  <TableCell>{r.beneficiary_name ?? "—"}</TableCell>
                  <TableCell>{r.context === "personal" ? "شخصي" : "عمل"}</TableCell>
                  {showPayment && (
                    <TableCell>
                      {r.payment_type === "partial"
                        ? `جزئي (دفع ${fmtEGP(Number(r.paid_amount ?? 0))})`
                        : r.payment_type === "credit"
                          ? "آجل"
                          : "كاش"}
                    </TableCell>
                  )}
                  <TableCell className="text-left font-medium">{fmtEGP(Number(r.amount))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

export function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
