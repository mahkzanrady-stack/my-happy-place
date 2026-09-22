export const fmtEGP = (n: number) =>
  `${new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 2 }).format(n)} جنيه`;

export const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium" }).format(new Date(iso));

export const DIRECTION_LABELS = { in: "داخل", out: "خارج" } as const;
export const CONTEXT_LABELS = { personal: "شخصي", business: "عمل" } as const;
export const PAYMENT_LABELS = { cash: "كاش", credit: "آجل", partial: "جزئي" } as const;
export const BENEFICIARY_KINDS = {
  supplier: "مورد",
  shipping_company: "شركة شحن",
  shipping_agent: "مندوب شحن",
  employee: "موظف",
  other: "جهة أخرى",
} as const;

export type Period = "all" | "today" | "week" | "month" | "year";
export const PERIOD_LABELS: Record<Period, string> = {
  all: "كل الفترات",
  today: "اليوم",
  week: "آخر ٧ أيام",
  month: "آخر ٣٠ يوم",
  year: "آخر سنة",
};

export function periodStart(period: Period): Date | null {
  const now = new Date();
  switch (period) {
    case "today": {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case "week":
      return new Date(now.getTime() - 7 * 86400000);
    case "month":
      return new Date(now.getTime() - 30 * 86400000);
    case "year":
      return new Date(now.getTime() - 365 * 86400000);
    default:
      return null;
  }
}
