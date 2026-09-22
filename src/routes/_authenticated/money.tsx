import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  BeneficiaryPicker,
  FormField,
  MovementTypePicker,
  TxList,
  type TxRow,
} from "@/components/dafter";

export const Route = createFileRoute("/_authenticated/money")({
  head: () => ({
    meta: [
      { title: "أموال | dafter" },
      { name: "description", content: "سجّل الأموال الداخلة والخارجة وتابع كل العمليات." },
      { property: "og:title", content: "أموال | dafter" },
      { property: "og:description", content: "سجّل الأموال الداخلة والخارجة وتابع كل العمليات." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MoneyPage,
});

function MoneyPage() {
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [typeId, setTypeId] = useState("");
  const [amount, setAmount] = useState("");
  const [context, setContext] = useState<"business" | "personal">("business");
  const [beneficiaryId, setBeneficiaryId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const { data: rows } = useQuery({
    queryKey: ["money_transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("money_transactions")
        .select("id, direction, amount, context, notes, occurred_at, movement_types(name), beneficiaries(name)")
        .is("deleted_at", null)
        .order("occurred_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        id: r.id,
        direction: r.direction,
        amount: r.amount,
        context: r.context,
        notes: r.notes,
        occurred_at: r.occurred_at,
        type_name: r.movement_types?.name ?? null,
        beneficiary_name: r.beneficiaries?.name ?? null,
      })) as TxRow[];
    },
  });

  async function save() {
    const value = Number(amount);
    if (!value || value < 0) {
      toast.error("اكتب قيمة صحيحة");
      return;
    }
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setSaving(false);
      return;
    }
    const { error } = await supabase.from("money_transactions").insert({
      user_id: userData.user.id,
      direction,
      type_id: typeId || null,
      amount: value,
      context,
      beneficiary_id: beneficiaryId || null,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast.error("حصلت مشكلة أثناء الحفظ");
      return;
    }
    toast.success("اتسجلت العملية");
    setAmount("");
    setNotes("");
    await queryClient.invalidateQueries({ queryKey: ["money_transactions"] });
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">أموال</h2>

      <Card>
        <CardHeader>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={direction === "in" ? "default" : "outline"}
              size="lg"
              onClick={() => setDirection("in")}
            >
              داخل
            </Button>
            <Button
              variant={direction === "out" ? "default" : "outline"}
              size="lg"
              onClick={() => setDirection("out")}
            >
              خارج
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField label={direction === "in" ? "نوع الداخل" : "نوع الخارج"}>
            <MovementTypePicker domain="money" value={typeId} onChange={setTypeId} />
          </FormField>

          <FormField label="القيمة (جنيه)">
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              dir="ltr"
              className="text-left"
            />
          </FormField>

          <FormField label="شخصي ولا عمل؟">
            <RadioGroup
              value={context}
              onValueChange={(v) => setContext(v as "business" | "personal")}
              className="flex gap-4"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="business" id="m-biz" />
                <Label htmlFor="m-biz">عمل</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="personal" id="m-per" />
                <Label htmlFor="m-per">شخصي</Label>
              </div>
            </RadioGroup>
          </FormField>

          <FormField label="المستفيد">
            <BeneficiaryPicker value={beneficiaryId} onChange={setBeneficiaryId} />
          </FormField>

          <FormField label="ملاحظات (اختياري)">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </FormField>

          <Button className="w-full" size="lg" onClick={save} disabled={saving}>
            {saving ? "بيحفظ..." : "سجّل العملية"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">العمليات</CardTitle>
        </CardHeader>
        <CardContent>
          <TxList rows={rows ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}
