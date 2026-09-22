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

export const Route = createFileRoute("/_authenticated/goods")({
  head: () => ({
    meta: [
      { title: "بضاعة | dafter" },
      { name: "description", content: "سجّل البضاعة الداخلة والخارجة وتابع كل العمليات." },
      { property: "og:title", content: "بضاعة | dafter" },
      { property: "og:description", content: "سجّل البضاعة الداخلة والخارجة وتابع كل العمليات." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GoodsPage,
});

function GoodsPage() {
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [typeId, setTypeId] = useState("");
  const [amount, setAmount] = useState("");
  const [context, setContext] = useState<"business" | "personal">("business");
  const [paymentType, setPaymentType] = useState<"cash" | "credit" | "partial">("cash");
  const [paidAmount, setPaidAmount] = useState("");
  const [beneficiaryId, setBeneficiaryId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const { data: rows } = useQuery({
    queryKey: ["goods_transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goods_transactions")
        .select("id, direction, amount, context, payment_type, paid_amount, notes, occurred_at, movement_types(name), beneficiaries(name)")
        .is("deleted_at", null)
        .order("occurred_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        id: r.id,
        direction: r.direction,
        amount: r.amount,
        context: r.context,
        payment_type: r.payment_type,
        paid_amount: r.paid_amount,
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
    if (paymentType === "partial") {
      const paid = Number(paidAmount);
      if (!paid || paid <= 0 || paid >= value) {
        toast.error("في الجزئي: المدفوع دلوقتي لازم يكون أكبر من صفر وأقل من القيمة");
        return;
      }
    }
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setSaving(false);
      return;
    }
    const paid =
      paymentType === "cash" ? value : paymentType === "credit" ? 0 : Number(paidAmount);
    const { error } = await supabase.from("goods_transactions").insert({
      user_id: userData.user.id,
      direction,
      type_id: typeId || null,
      amount: value,
      context,
      payment_type: paymentType,
      paid_amount: paid,
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
    setPaidAmount("");
    setNotes("");
    setPaymentType("cash");
    await queryClient.invalidateQueries({ queryKey: ["goods_transactions"] });
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">بضاعة</h2>

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
            <MovementTypePicker domain="goods" value={typeId} onChange={setTypeId} />
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
                <RadioGroupItem value="business" id="g-biz" />
                <Label htmlFor="g-biz">عمل</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="personal" id="g-per" />
                <Label htmlFor="g-per">شخصي</Label>
              </div>
            </RadioGroup>
          </FormField>

          <FormField label="نوع العملية">
            <RadioGroup
              value={paymentType}
              onValueChange={(v) => setPaymentType(v as "cash" | "credit" | "partial")}
              className="flex gap-4"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="cash" id="g-cash" />
                <Label htmlFor="g-cash">كاش</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="credit" id="g-credit" />
                <Label htmlFor="g-credit">آجل</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="partial" id="g-partial" />
                <Label htmlFor="g-partial">جزئي</Label>
              </div>
            </RadioGroup>
          </FormField>

          {paymentType === "partial" && (
            <FormField label="المدفوع دلوقتي (جنيه) — الباقي هيتحسب متأخر على المستفيد">
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                dir="ltr"
                className="text-left"
              />
            </FormField>
          )}

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
          <TxList rows={rows ?? []} showPayment />
        </CardContent>
      </Card>
    </div>
  );
}
