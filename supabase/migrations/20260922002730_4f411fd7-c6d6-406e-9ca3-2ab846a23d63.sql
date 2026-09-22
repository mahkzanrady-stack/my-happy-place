-- dafter core tables (T1.1 + T1.2 + T1.3)

CREATE TYPE public.beneficiary_kind AS ENUM ('supplier','shipping_company','shipping_agent','employee','other');
CREATE TYPE public.movement_domain AS ENUM ('goods','money');
CREATE TYPE public.tx_direction AS ENUM ('in','out');
CREATE TYPE public.tx_context AS ENUM ('personal','business');
CREATE TYPE public.payment_type AS ENUM ('cash','credit','partial');

-- المستفيدون
CREATE TABLE public.beneficiaries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind public.beneficiary_kind NOT NULL DEFAULT 'other',
  phone text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.beneficiaries TO authenticated;
GRANT ALL ON public.beneficiaries TO service_role;
ALTER TABLE public.beneficiaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own beneficiaries" ON public.beneficiaries FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER beneficiaries_touch BEFORE UPDATE ON public.beneficiaries
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- أنواع الحركة (ينشئها المستخدم)
CREATE TABLE public.movement_types (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  domain public.movement_domain NOT NULL,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, domain, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.movement_types TO authenticated;
GRANT ALL ON public.movement_types TO service_role;
ALTER TABLE public.movement_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own movement types" ON public.movement_types FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- عمليات البضاعة
CREATE TABLE public.goods_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  direction public.tx_direction NOT NULL,
  type_id uuid REFERENCES public.movement_types(id) ON DELETE SET NULL,
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  context public.tx_context NOT NULL DEFAULT 'business',
  payment_type public.payment_type NOT NULL DEFAULT 'cash',
  paid_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  beneficiary_id uuid REFERENCES public.beneficiaries(id) ON DELETE RESTRICT,
  notes text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT partial_payment_check CHECK (
    payment_type <> 'partial' OR (paid_amount > 0 AND paid_amount < amount)
  )
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goods_transactions TO authenticated;
GRANT ALL ON public.goods_transactions TO service_role;
ALTER TABLE public.goods_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own goods transactions" ON public.goods_transactions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER goods_transactions_touch BEFORE UPDATE ON public.goods_transactions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX goods_tx_user_date ON public.goods_transactions (user_id, occurred_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX goods_tx_beneficiary ON public.goods_transactions (beneficiary_id) WHERE deleted_at IS NULL;

-- عمليات الأموال
CREATE TABLE public.money_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  direction public.tx_direction NOT NULL,
  type_id uuid REFERENCES public.movement_types(id) ON DELETE SET NULL,
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  context public.tx_context NOT NULL DEFAULT 'business',
  beneficiary_id uuid REFERENCES public.beneficiaries(id) ON DELETE RESTRICT,
  notes text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.money_transactions TO authenticated;
GRANT ALL ON public.money_transactions TO service_role;
ALTER TABLE public.money_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own money transactions" ON public.money_transactions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER money_transactions_touch BEFORE UPDATE ON public.money_transactions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX money_tx_user_date ON public.money_transactions (user_id, occurred_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX money_tx_beneficiary ON public.money_transactions (beneficiary_id) WHERE deleted_at IS NULL;

-- رصيد أول المدة
CREATE TABLE public.user_settings (
  user_id uuid NOT NULL PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  opening_balance numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.user_settings TO authenticated;
GRANT ALL ON public.user_settings TO service_role;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own settings" ON public.user_settings FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER user_settings_touch BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- سجل تعديلات رصيد أول المدة
CREATE TABLE public.opening_balance_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  old_value numeric(14,2) NOT NULL,
  new_value numeric(14,2) NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.opening_balance_history TO authenticated;
GRANT ALL ON public.opening_balance_history TO service_role;
ALTER TABLE public.opening_balance_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own opening balance history" ON public.opening_balance_history FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "users insert own opening balance history" ON public.opening_balance_history FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- تسجيل تعديل رصيد أول المدة تلقائيًا في السجل
CREATE OR REPLACE FUNCTION public.log_opening_balance_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
BEGIN
  IF OLD.opening_balance IS DISTINCT FROM NEW.opening_balance THEN
    INSERT INTO public.opening_balance_history (user_id, old_value, new_value)
    VALUES (NEW.user_id, OLD.opening_balance, NEW.opening_balance);
  END IF;
  RETURN NEW;
END;
$func$;
CREATE TRIGGER user_settings_log_opening AFTER UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.log_opening_balance_change();