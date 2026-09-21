SET check_function_bodies = false;
DROP TABLE IF EXISTS public.artifacts CASCADE;
DROP TABLE IF EXISTS public.checkpoints CASCADE;
DROP TABLE IF EXISTS public.constitution_rule_history CASCADE;
DROP TABLE IF EXISTS public.constitution_rules CASCADE;
DROP TABLE IF EXISTS public.constitution_sections CASCADE;
DROP TABLE IF EXISTS public.constitutions CASCADE;
DROP TABLE IF EXISTS public.execution_logs CASCADE;
DROP TABLE IF EXISTS public.execution_position CASCADE;
DROP TABLE IF EXISTS public.phases CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.project_decisions CASCADE;
DROP TABLE IF EXISTS public.project_description CASCADE;
DROP TABLE IF EXISTS public.project_description_history CASCADE;
DROP TABLE IF EXISTS public.project_execution_summary CASCADE;
DROP TABLE IF EXISTS public.projects CASCADE;
DROP TABLE IF EXISTS public.resume_packages CASCADE;
DROP TABLE IF EXISTS public.state_conflicts CASCADE;
DROP TABLE IF EXISTS public.task_artifacts CASCADE;
DROP TABLE IF EXISTS public.task_changes CASCADE;
DROP TABLE IF EXISTS public.task_constitution_rules CASCADE;
DROP TABLE IF EXISTS public.task_cycles CASCADE;
DROP TABLE IF EXISTS public.task_dependencies CASCADE;
DROP TABLE IF EXISTS public.task_executions CASCADE;
DROP TABLE IF EXISTS public.task_relations CASCADE;
DROP TABLE IF EXISTS public.tasks CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TYPE IF EXISTS public.artifact_action CASCADE;
DROP TYPE IF EXISTS public.artifact_kind CASCADE;
DROP TYPE IF EXISTS public.conflict_status CASCADE;
DROP TYPE IF EXISTS public.decision_status CASCADE;
DROP TYPE IF EXISTS public.execution_session_status CASCADE;
DROP TYPE IF EXISTS public.resume_reason CASCADE;
DROP TYPE IF EXISTS public.rule_category CASCADE;
DROP TYPE IF EXISTS public.rule_severity CASCADE;
DROP TYPE IF EXISTS public.rule_severity_level CASCADE;
DROP TYPE IF EXISTS public.rule_status CASCADE;
DROP TYPE IF EXISTS public.task_status CASCADE;
DROP TYPE IF EXISTS public.app_role CASCADE;
CREATE TYPE public.app_role AS ENUM (
    'admin',
    'admin_staff',
    'user',
    'user_staff'
);
CREATE TYPE public.artifact_action AS ENUM (
    'created',
    'modified',
    'deleted',
    'inspected',
    'verified'
);
CREATE TYPE public.artifact_kind AS ENUM (
    'file',
    'table',
    'api',
    'component',
    'other',
    'integration'
);
CREATE TYPE public.conflict_status AS ENUM (
    'open',
    'investigating',
    'resolved',
    'dismissed'
);
CREATE TYPE public.decision_status AS ENUM (
    'active',
    'superseded',
    'reverted'
);
CREATE TYPE public.execution_session_status AS ENUM (
    'running',
    'paused',
    'completed',
    'aborted'
);
CREATE TYPE public.resume_reason AS ENUM (
    'NEW_TASK',
    'OPEN_TASK',
    'REOPENED_TASK',
    'BLOCKED_TASK',
    'RESUME_AFTER_SESSION_END',
    'RESUME_AFTER_RESOURCE_EXHAUSTION'
);
CREATE TYPE public.rule_category AS ENUM (
    'red_line',
    'warning',
    'recommendation',
    'execution_rule',
    'verification_rule'
);
CREATE TYPE public.rule_severity AS ENUM (
    'red_line',
    'caution',
    'recommendation',
    'execution_rule',
    'verification_rule'
);
CREATE TYPE public.rule_severity_level AS ENUM (
    'critical',
    'high',
    'normal'
);
CREATE TYPE public.rule_status AS ENUM (
    'active',
    'disabled',
    'archived'
);
CREATE TYPE public.task_status AS ENUM (
    'pending',
    'in_progress',
    'completed',
    'reopened',
    'cancelled',
    'soft_deleted',
    'blocked',
    'verify'
);
CREATE OR REPLACE FUNCTION public.get_minimal_task_context(_task_id uuid) RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select jsonb_build_object(
    'task', to_jsonb(t) - 'description',
    'task_description', t.description,
    'resume_package', (select to_jsonb(r) from public.resume_packages r where r.task_id = t.id and r.is_active limit 1),
    'last_checkpoint', (select to_jsonb(c) from public.checkpoints c where c.task_id = t.id order by c.created_at desc limit 1),
    'relevant_decisions', coalesce((select jsonb_agg(to_jsonb(d)) from public.project_decisions d where d.task_id = t.id and d.status = 'active'), '[]'::jsonb),
    'relevant_constitution_rules', coalesce((select jsonb_agg(jsonb_build_object('code', cr.code, 'severity', cr.category, 'rule_text', cr.rule_text, 'note', tcr.relevance_note))
        from public.task_constitution_rules tcr join public.constitution_rules cr on cr.id = tcr.rule_id
        where tcr.task_id = t.id and cr.status = 'active'), '[]'::jsonb),
    'registered_artifacts', coalesce((select jsonb_agg(jsonb_build_object('kind', a.kind, 'identifier', a.identifier, 'action', ta.action, 'purpose', ta.purpose))
        from public.task_artifacts ta join public.artifacts a on a.id = ta.artifact_id where ta.task_id = t.id), '[]'::jsonb),
    'dependencies', coalesce((select jsonb_agg(jsonb_build_object('code', dt.code, 'title', dt.title, 'status', dt.status))
        from public.task_dependencies td join public.tasks dt on dt.id = td.depends_on_task_id where td.task_id = t.id), '[]'::jsonb),
    'open_conflicts', coalesce((select jsonb_agg(to_jsonb(sc)) from public.state_conflicts sc where sc.task_id = t.id and sc.status in ('open','investigating')), '[]'::jsonb),
    'recent_logs', coalesce((select jsonb_agg(jsonb_build_object('event_type', l.event_type, 'description', l.description, 'outcome', l.outcome, 'at', l.created_at))
        from (select * from public.execution_logs el where el.task_id = t.id order by el.created_at desc limit 10) l), '[]'::jsonb)
  )
  from public.tasks t
  where t.id = _task_id;
$$;
CREATE OR REPLACE FUNCTION public.get_resume_message(_project_id uuid) RETURNS text
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public'
    AS $$
DECLARE
  p record;
  pos record;
  cur record;
  ph record;
  lastc record;
  chk record;
  nxt record;
  rp record;
  blockers text;
  affected text;
  msg text;
BEGIN
  SELECT * INTO p FROM public.projects WHERE id = _project_id;
  IF NOT FOUND THEN
    RETURN 'PROJECT RESUME POSITION' || E'\n\n' || 'لا يوجد مشروع بهذا المعرف.';
  END IF;
  SELECT * INTO pos FROM public.execution_position
   WHERE project_id = _project_id AND is_active
   ORDER BY updated_at DESC LIMIT 1;
  SELECT * INTO cur FROM public.tasks
   WHERE project_id = _project_id AND deleted_at IS NULL
     AND status IN ('in_progress','reopened','blocked','verify')
   ORDER BY CASE status
       WHEN 'in_progress' THEN 1
       WHEN 'reopened' THEN 2
       WHEN 'verify' THEN 3
       WHEN 'blocked' THEN 4 END,
     priority DESC, updated_at DESC
   LIMIT 1;
  IF cur IS NULL AND pos.current_task_id IS NOT NULL THEN
    SELECT * INTO cur FROM public.tasks WHERE id = pos.current_task_id;
  END IF;
  IF cur.phase_id IS NOT NULL THEN
    SELECT * INTO ph FROM public.phases WHERE id = cur.phase_id;
  ELSIF pos.current_phase_id IS NOT NULL THEN
    SELECT * INTO ph FROM public.phases WHERE id = pos.current_phase_id;
  END IF;
  SELECT * INTO lastc FROM public.tasks
   WHERE project_id = _project_id AND status = 'completed' AND deleted_at IS NULL
   ORDER BY completed_at DESC NULLS LAST, updated_at DESC LIMIT 1;
  IF cur.id IS NOT NULL THEN
    SELECT * INTO chk FROM public.checkpoints
     WHERE task_id = cur.id ORDER BY created_at DESC LIMIT 1;
    SELECT * INTO rp FROM public.resume_packages
     WHERE task_id = cur.id AND is_active ORDER BY updated_at DESC LIMIT 1;
  END IF;
  IF pos.next_natural_task_id IS NOT NULL THEN
    SELECT * INTO nxt FROM public.tasks WHERE id = pos.next_natural_task_id;
  ELSE
    SELECT t.* INTO nxt FROM public.tasks t
      LEFT JOIN public.phases f ON f.id = t.phase_id
     WHERE t.project_id = _project_id AND t.deleted_at IS NULL
       AND t.status = 'pending'
       AND (cur.id IS NULL OR t.id <> cur.id)
       AND NOT EXISTS (
         SELECT 1 FROM public.task_dependencies d
           JOIN public.tasks dt ON dt.id = d.depends_on_task_id
          WHERE d.task_id = t.id AND dt.status <> 'completed')
     ORDER BY COALESCE(f.sort_order, 2147483647), t.priority DESC, t.created_at
     LIMIT 1;
  END IF;
  blockers := COALESCE(NULLIF(pos.blocked_by,''), NULLIF(cur.notes, ''));
  SELECT string_agg(dt.code || ' — ' || dt.title, E'\n') INTO affected
    FROM public.tasks dt
   WHERE dt.project_id = _project_id AND dt.deleted_at IS NULL
     AND cur.id IS NOT NULL
     AND dt.id = ANY (SELECT unnest(COALESCE(pos.affected_later_tasks, '{}'::text[]))::uuid);
  msg :=
    'PROJECT RESUME POSITION' || E'\n\n' ||
    'المشروع: ' || p.name || E'\n\n' ||
    'أين نحن؟' || E'\n' || COALESCE(ph.title, 'لم تُحدد مرحلة') || E'\n\n' ||
    'المهمة الحالية:' || E'\n' || COALESCE(COALESCE(cur.code || ' — ', '') || cur.title, 'لا توجد مهمة مفتوحة') || E'\n\n' ||
    'حالة المهمة:' || E'\n' || COALESCE(upper(cur.status::text), '—') || E'\n\n' ||
    'لماذا نحن هنا؟' || E'\n' || COALESCE(pos.resume_reason::text,
        CASE cur.status
          WHEN 'in_progress' THEN 'OPEN_TASK'
          WHEN 'reopened' THEN 'REOPENED_TASK'
          WHEN 'blocked' THEN 'BLOCKED_TASK'
          ELSE 'NEW_TASK' END) || E'\n\n' ||
    'آخر مهمة مكتملة:' || E'\n' || COALESCE(COALESCE(lastc.code || ' — ', '') || lastc.title, 'لا يوجد') || E'\n\n' ||
    'ما تم:' || E'\n' || COALESCE(NULLIF(rp.completed,''), NULLIF(chk.done_summary,''), NULLIF(pos.completed_work,''), 'غير مسجل') || E'\n\n' ||
    'ما تبقى:' || E'\n' || COALESCE(NULLIF(rp.remaining,''), NULLIF(chk.remaining,''), NULLIF(pos.remaining_work,''), 'غير مسجل') || E'\n\n' ||
    'آخر Checkpoint:' || E'\n' || COALESCE(chk.last_successful_step || ' (' || to_char(chk.created_at,'YYYY-MM-DD HH24:MI') || ')', 'لا يوجد') || E'\n\n' ||
    'Last Known Good State:' || E'\n' || COALESCE(NULLIF(rp.last_known_good_state,''), NULLIF(cur.last_known_good_state,''), NULLIF(pos.last_known_good_state,''), 'غير مسجل') || E'\n\n' ||
    'Next Action:' || E'\n' || COALESCE(NULLIF(rp.next_action,''), NULLIF(chk.next_action,''), NULLIF(cur.next_action,''), NULLIF(pos.next_action,''), 'غير محدد — يحدده المستخدم') || E'\n\n' ||
    'Next Natural Task:' || E'\n' || COALESCE(COALESCE(nxt.code || ' — ', '') || nxt.title, 'لا يوجد') || E'\n\n' ||
    'قاعدة الاستئناف:' || E'\n' ||
      CASE
        WHEN cur.id IS NULL THEN 'لا توجد مهمة مفتوحة. اعرض المهمة الطبيعية التالية وانتظر إذن المستخدم. لا تبدأ تلقائيًا.'
        WHEN cur.status = 'blocked' THEN 'المهمة محجوبة: ' || COALESCE(blockers,'السبب غير مسجل') || '. لا تتجاوزها ولا تنشئ مسارًا بديلًا.'
        WHEN cur.status = 'reopened' THEN 'هذه المهمة كانت مكتملة ثم أُعيد فتحها، فهي نقطة التنفيذ الحالية حتى لو وُجدت مهام لاحقة مكتملة. أكملها وتحقق منها قبل الانتقال.'
        WHEN cur.status = 'verify' THEN 'المهمة في مرحلة التحقق. أكمل التحقق وسجل النتائج قبل الإغلاق.'
        ELSE 'المهمة مفتوحة. أكملها من Next Action ولا تنتقل إلى المهمة التالية.'
      END || E'\n\n' ||
    'المهام اللاحقة المتأثرة:' || E'\n' || COALESCE(affected, 'لا يوجد');
  RETURN msg;
END;
$$;
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into public.profiles (id, email, full_name, manager_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'manager_id','')::uuid
  )
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role)
  values (new.id, coalesce((new.raw_user_meta_data->>'role')::public.app_role, 'user'))
  on conflict do nothing;
  return new;
end;
$$;
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role);
$$;
CREATE OR REPLACE FUNCTION public.is_manager_of(_manager uuid, _staff uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (select 1 from public.profiles where id = _staff and manager_id = _manager);
$$;
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin new.updated_at = now(); return new; end; $$;
CREATE TABLE public.artifacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    kind public.artifact_kind NOT NULL,
    identifier text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.checkpoints (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    task_id uuid NOT NULL,
    cycle_id uuid,
    status public.task_status DEFAULT 'in_progress'::public.task_status NOT NULL,
    is_final boolean DEFAULT false NOT NULL,
    done_summary text NOT NULL,
    last_successful_step text NOT NULL,
    remaining text,
    next_action text NOT NULL,
    changed_files text[] DEFAULT '{}'::text[] NOT NULL,
    changed_tables text[] DEFAULT '{}'::text[] NOT NULL,
    changed_apis text[] DEFAULT '{}'::text[] NOT NULL,
    tests text,
    issues text,
    decisions text,
    actor text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    execution_id uuid
);
CREATE TABLE public.constitution_rule_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rule_id uuid NOT NULL,
    project_id uuid NOT NULL,
    old_rule_text text,
    new_rule_text text,
    old_status public.rule_status,
    new_status public.rule_status,
    change_reason text NOT NULL,
    related_task_id uuid,
    approved_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.constitution_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    section_id uuid,
    code text,
    rule_text text NOT NULL,
    rationale text,
    status public.rule_status DEFAULT 'active'::public.rule_status NOT NULL,
    keywords text[] DEFAULT '{}'::text[] NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    constitution_id uuid,
    category public.rule_category DEFAULT 'recommendation'::public.rule_category NOT NULL,
    severity_level public.rule_severity_level DEFAULT 'normal'::public.rule_severity_level NOT NULL
);
CREATE TABLE public.constitution_sections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    key text NOT NULL,
    title text NOT NULL,
    description text,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    constitution_id uuid
);
CREATE TABLE public.constitutions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    name text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    summary text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.execution_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    task_id uuid,
    cycle_id uuid,
    event_type text NOT NULL,
    description text NOT NULL,
    outcome text,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    actor text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    execution_id uuid
);
CREATE TABLE public.execution_position (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    current_phase_id uuid,
    current_task_id uuid,
    task_status public.task_status,
    resume_reason public.resume_reason,
    last_completed_task_id uuid,
    last_checkpoint_id uuid,
    last_execution_id uuid,
    last_known_good_state text,
    completed_work text,
    remaining_work text,
    next_action text,
    next_natural_task_id uuid,
    next_natural_task_note text,
    blocked_by text,
    reopened_from_task_id uuid,
    affected_later_tasks uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    resume_rule text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.phases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    key text NOT NULL,
    title text NOT NULL,
    description text,
    status text DEFAULT 'pending'::text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text,
    full_name text,
    manager_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.project_decisions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    task_id uuid,
    title text,
    decision text NOT NULL,
    reason text NOT NULL,
    alternatives text,
    impact text,
    status public.decision_status DEFAULT 'active'::public.decision_status NOT NULL,
    superseded_by uuid,
    decided_by text,
    decided_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
COMMENT ON COLUMN public.project_decisions.superseded_by IS 'القرار الذي ألغى هذا القرار (اتجاه: أُلغي بواسطة)';
CREATE TABLE public.project_description (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    description text,
    vision text,
    goal text,
    purpose text,
    problem_solved text,
    target_users text,
    core_principles text[] DEFAULT '{}'::text[] NOT NULL,
    main_systems text[] DEFAULT '{}'::text[] NOT NULL,
    main_components text[] DEFAULT '{}'::text[] NOT NULL,
    technologies text[] DEFAULT '{}'::text[] NOT NULL,
    architecture text,
    integrations text[] DEFAULT '{}'::text[] NOT NULL,
    fixed_facts jsonb DEFAULT '{}'::jsonb NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by text
);
CREATE TABLE public.project_description_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    version integer NOT NULL,
    snapshot jsonb NOT NULL,
    change_reason text,
    changed_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.project_execution_summary (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    what_is_project text,
    current_focus text,
    stack text,
    overall_state text,
    operational_constraints text[] DEFAULT '{}'::text[] NOT NULL,
    last_important_point text,
    current_task_id uuid,
    is_authoritative boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid DEFAULT auth.uid() NOT NULL,
    name text NOT NULL,
    slug text,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    description_id uuid,
    current_task_id uuid,
    active_constitution_id uuid
);
CREATE TABLE public.resume_packages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    task_id uuid NOT NULL,
    cycle_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    current_state text,
    completed text,
    remaining text,
    last_known_good_state text,
    next_action text NOT NULL,
    relevant_files text[] DEFAULT '{}'::text[] NOT NULL,
    relevant_tables text[] DEFAULT '{}'::text[] NOT NULL,
    relevant_apis text[] DEFAULT '{}'::text[] NOT NULL,
    relevant_decisions text[] DEFAULT '{}'::text[] NOT NULL,
    relevant_rules text[] DEFAULT '{}'::text[] NOT NULL,
    last_checkpoint_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    position_id uuid,
    resume_reason public.resume_reason
);
CREATE TABLE public.state_conflicts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    task_id uuid,
    description text NOT NULL,
    inspected_scope text,
    finding text,
    resolution text,
    source_a text,
    source_b text,
    status public.conflict_status DEFAULT 'open'::public.conflict_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    execution_id uuid,
    affected_artifact text,
    resolved_at timestamp with time zone
);
CREATE TABLE public.task_artifacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    task_id uuid NOT NULL,
    artifact_id uuid NOT NULL,
    action public.artifact_action DEFAULT 'modified'::public.artifact_action NOT NULL,
    purpose text,
    cycle_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.task_changes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    task_id uuid NOT NULL,
    field_name text NOT NULL,
    old_value text,
    new_value text,
    change_reason text,
    changed_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.task_constitution_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    task_id uuid NOT NULL,
    rule_id uuid NOT NULL,
    relevance_note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.task_cycles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    task_id uuid NOT NULL,
    cycle_number integer DEFAULT 1 NOT NULL,
    reason text,
    opened_at timestamp with time zone DEFAULT now() NOT NULL,
    closed_at timestamp with time zone,
    outcome text
);
CREATE TABLE public.task_dependencies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    task_id uuid NOT NULL,
    depends_on_task_id uuid NOT NULL,
    dependency_type text DEFAULT 'blocks'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT task_dependencies_check CHECK ((task_id <> depends_on_task_id))
);
CREATE TABLE public.task_executions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    task_id uuid NOT NULL,
    cycle_id uuid,
    executor_type text DEFAULT 'lovable'::text NOT NULL,
    executor_name text,
    status public.execution_session_status DEFAULT 'running'::public.execution_session_status NOT NULL,
    stop_reason text,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    ended_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.task_relations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    task_id uuid NOT NULL,
    related_task_id uuid NOT NULL,
    relation_type text DEFAULT 'related'::text NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT task_relations_check CHECK ((task_id <> related_task_id))
);
CREATE TABLE public.tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    phase_id uuid,
    code text,
    title text NOT NULL,
    description text,
    goal text,
    reason text,
    status public.task_status DEFAULT 'pending'::public.task_status NOT NULL,
    priority integer DEFAULT 3 NOT NULL,
    parent_task_id uuid,
    scope text,
    execution_approach text,
    execution_steps jsonb DEFAULT '[]'::jsonb NOT NULL,
    success_criteria text,
    testing_method text,
    risks text,
    notes text,
    required_tools text[] DEFAULT '{}'::text[] NOT NULL,
    required_relations text,
    keywords text[] DEFAULT '{}'::text[] NOT NULL,
    last_known_good_state text,
    next_action text,
    last_executor text,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE ONLY public.artifacts
    ADD CONSTRAINT artifacts_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.artifacts
    ADD CONSTRAINT artifacts_project_id_kind_identifier_key UNIQUE (project_id, kind, identifier);
ALTER TABLE ONLY public.checkpoints
    ADD CONSTRAINT checkpoints_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.constitution_rule_history
    ADD CONSTRAINT constitution_rule_history_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.constitution_rules
    ADD CONSTRAINT constitution_rules_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.constitution_rules
    ADD CONSTRAINT constitution_rules_project_id_code_key UNIQUE (project_id, code);
ALTER TABLE ONLY public.constitution_sections
    ADD CONSTRAINT constitution_sections_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.constitution_sections
    ADD CONSTRAINT constitution_sections_project_id_key_key UNIQUE (project_id, key);
ALTER TABLE ONLY public.constitutions
    ADD CONSTRAINT constitutions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.execution_logs
    ADD CONSTRAINT execution_logs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.execution_position
    ADD CONSTRAINT execution_position_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.phases
    ADD CONSTRAINT phases_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.phases
    ADD CONSTRAINT phases_project_id_key_key UNIQUE (project_id, key);
ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.project_decisions
    ADD CONSTRAINT project_decisions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.project_description_history
    ADD CONSTRAINT project_description_history_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.project_description
    ADD CONSTRAINT project_description_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.project_description
    ADD CONSTRAINT project_description_project_id_key UNIQUE (project_id);
ALTER TABLE ONLY public.project_execution_summary
    ADD CONSTRAINT project_execution_summary_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.project_execution_summary
    ADD CONSTRAINT project_execution_summary_project_id_key UNIQUE (project_id);
ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.resume_packages
    ADD CONSTRAINT resume_packages_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.state_conflicts
    ADD CONSTRAINT state_conflicts_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.task_artifacts
    ADD CONSTRAINT task_artifacts_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.task_changes
    ADD CONSTRAINT task_changes_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.task_constitution_rules
    ADD CONSTRAINT task_constitution_rules_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.task_constitution_rules
    ADD CONSTRAINT task_constitution_rules_task_id_rule_id_key UNIQUE (task_id, rule_id);
ALTER TABLE ONLY public.task_cycles
    ADD CONSTRAINT task_cycles_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.task_cycles
    ADD CONSTRAINT task_cycles_task_id_cycle_number_key UNIQUE (task_id, cycle_number);
ALTER TABLE ONLY public.task_dependencies
    ADD CONSTRAINT task_dependencies_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.task_dependencies
    ADD CONSTRAINT task_dependencies_task_id_depends_on_task_id_key UNIQUE (task_id, depends_on_task_id);
ALTER TABLE ONLY public.task_executions
    ADD CONSTRAINT task_executions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.task_relations
    ADD CONSTRAINT task_relations_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.task_relations
    ADD CONSTRAINT task_relations_task_id_related_task_id_relation_type_key UNIQUE (task_id, related_task_id, relation_type);
ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_project_id_code_key UNIQUE (project_id, code);
ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);
CREATE UNIQUE INDEX execution_position_one_active ON public.execution_position USING btree (project_id) WHERE is_active;
CREATE INDEX idx_checkpoints_task_id ON public.checkpoints USING btree (task_id);
CREATE INDEX idx_checkpoints_task_time ON public.checkpoints USING btree (task_id, created_at DESC);
CREATE INDEX idx_constitution_rules_constitution_id ON public.constitution_rules USING btree (constitution_id);
CREATE INDEX idx_execution_logs_task_id ON public.execution_logs USING btree (task_id);
CREATE INDEX idx_logs_task_time ON public.execution_logs USING btree (task_id, created_at DESC);
CREATE INDEX idx_project_decisions_superseded_by ON public.project_decisions USING btree (superseded_by);
CREATE INDEX idx_resume_packages_task_id ON public.resume_packages USING btree (task_id);
CREATE INDEX idx_task_artifacts_task ON public.task_artifacts USING btree (task_id);
CREATE INDEX idx_task_artifacts_task_id ON public.task_artifacts USING btree (task_id);
CREATE INDEX idx_tasks_phase_id ON public.tasks USING btree (phase_id);
CREATE INDEX idx_tasks_project_id ON public.tasks USING btree (project_id);
CREATE INDEX idx_tasks_project_status ON public.tasks USING btree (project_id, status);
CREATE UNIQUE INDEX uniq_active_resume_per_task ON public.resume_packages USING btree (task_id) WHERE is_active;
CREATE TRIGGER phases_touch BEFORE UPDATE ON public.phases FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_artifacts_touch BEFORE UPDATE ON public.artifacts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_conflicts_touch BEFORE UPDATE ON public.state_conflicts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_constitution_rules_touch BEFORE UPDATE ON public.constitution_rules FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_constitution_sections_touch BEFORE UPDATE ON public.constitution_sections FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_constitutions_touch BEFORE UPDATE ON public.constitutions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_execution_position_touch BEFORE UPDATE ON public.execution_position FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_project_decisions_touch BEFORE UPDATE ON public.project_decisions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_project_description_touch BEFORE UPDATE ON public.project_description FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_project_execution_summary_touch BEFORE UPDATE ON public.project_execution_summary FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_projects_touch BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_resume_packages_touch BEFORE UPDATE ON public.resume_packages FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_tasks_touch BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
ALTER TABLE ONLY public.artifacts
    ADD CONSTRAINT artifacts_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.checkpoints
    ADD CONSTRAINT checkpoints_cycle_id_fkey FOREIGN KEY (cycle_id) REFERENCES public.task_cycles(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.checkpoints
    ADD CONSTRAINT checkpoints_execution_id_fkey FOREIGN KEY (execution_id) REFERENCES public.task_executions(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.checkpoints
    ADD CONSTRAINT checkpoints_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.checkpoints
    ADD CONSTRAINT checkpoints_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.constitution_rule_history
    ADD CONSTRAINT constitution_rule_history_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.constitution_rule_history
    ADD CONSTRAINT constitution_rule_history_related_task_id_fkey FOREIGN KEY (related_task_id) REFERENCES public.tasks(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.constitution_rule_history
    ADD CONSTRAINT constitution_rule_history_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.constitution_rules(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.constitution_rules
    ADD CONSTRAINT constitution_rules_constitution_id_fkey FOREIGN KEY (constitution_id) REFERENCES public.constitutions(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.constitution_rules
    ADD CONSTRAINT constitution_rules_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.constitution_rules
    ADD CONSTRAINT constitution_rules_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.constitution_sections(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.constitution_sections
    ADD CONSTRAINT constitution_sections_constitution_id_fkey FOREIGN KEY (constitution_id) REFERENCES public.constitutions(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.constitution_sections
    ADD CONSTRAINT constitution_sections_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.constitutions
    ADD CONSTRAINT constitutions_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.execution_logs
    ADD CONSTRAINT execution_logs_cycle_id_fkey FOREIGN KEY (cycle_id) REFERENCES public.task_cycles(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.execution_logs
    ADD CONSTRAINT execution_logs_execution_id_fkey FOREIGN KEY (execution_id) REFERENCES public.task_executions(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.execution_logs
    ADD CONSTRAINT execution_logs_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.execution_logs
    ADD CONSTRAINT execution_logs_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.execution_position
    ADD CONSTRAINT execution_position_current_phase_id_fkey FOREIGN KEY (current_phase_id) REFERENCES public.phases(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.execution_position
    ADD CONSTRAINT execution_position_current_task_id_fkey FOREIGN KEY (current_task_id) REFERENCES public.tasks(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.execution_position
    ADD CONSTRAINT execution_position_last_checkpoint_id_fkey FOREIGN KEY (last_checkpoint_id) REFERENCES public.checkpoints(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.execution_position
    ADD CONSTRAINT execution_position_last_completed_task_id_fkey FOREIGN KEY (last_completed_task_id) REFERENCES public.tasks(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.execution_position
    ADD CONSTRAINT execution_position_last_execution_id_fkey FOREIGN KEY (last_execution_id) REFERENCES public.task_executions(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.execution_position
    ADD CONSTRAINT execution_position_next_natural_task_id_fkey FOREIGN KEY (next_natural_task_id) REFERENCES public.tasks(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.execution_position
    ADD CONSTRAINT execution_position_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.execution_position
    ADD CONSTRAINT execution_position_reopened_from_task_id_fkey FOREIGN KEY (reopened_from_task_id) REFERENCES public.tasks(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.phases
    ADD CONSTRAINT phases_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.project_decisions
    ADD CONSTRAINT project_decisions_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.project_decisions
    ADD CONSTRAINT project_decisions_superseded_by_fkey FOREIGN KEY (superseded_by) REFERENCES public.project_decisions(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.project_decisions
    ADD CONSTRAINT project_decisions_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.project_description_history
    ADD CONSTRAINT project_description_history_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.project_description
    ADD CONSTRAINT project_description_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.project_execution_summary
    ADD CONSTRAINT project_execution_summary_current_task_id_fkey FOREIGN KEY (current_task_id) REFERENCES public.tasks(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.project_execution_summary
    ADD CONSTRAINT project_execution_summary_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_active_constitution_id_fkey FOREIGN KEY (active_constitution_id) REFERENCES public.constitutions(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_current_task_id_fkey FOREIGN KEY (current_task_id) REFERENCES public.tasks(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_description_id_fkey FOREIGN KEY (description_id) REFERENCES public.project_description(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.resume_packages
    ADD CONSTRAINT resume_packages_cycle_id_fkey FOREIGN KEY (cycle_id) REFERENCES public.task_cycles(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.resume_packages
    ADD CONSTRAINT resume_packages_last_checkpoint_id_fkey FOREIGN KEY (last_checkpoint_id) REFERENCES public.checkpoints(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.resume_packages
    ADD CONSTRAINT resume_packages_position_id_fkey FOREIGN KEY (position_id) REFERENCES public.execution_position(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.resume_packages
    ADD CONSTRAINT resume_packages_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.resume_packages
    ADD CONSTRAINT resume_packages_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.state_conflicts
    ADD CONSTRAINT state_conflicts_execution_id_fkey FOREIGN KEY (execution_id) REFERENCES public.task_executions(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.state_conflicts
    ADD CONSTRAINT state_conflicts_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.state_conflicts
    ADD CONSTRAINT state_conflicts_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.task_artifacts
    ADD CONSTRAINT task_artifacts_artifact_id_fkey FOREIGN KEY (artifact_id) REFERENCES public.artifacts(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.task_artifacts
    ADD CONSTRAINT task_artifacts_cycle_id_fkey FOREIGN KEY (cycle_id) REFERENCES public.task_cycles(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.task_artifacts
    ADD CONSTRAINT task_artifacts_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.task_artifacts
    ADD CONSTRAINT task_artifacts_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.task_changes
    ADD CONSTRAINT task_changes_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.task_changes
    ADD CONSTRAINT task_changes_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.task_constitution_rules
    ADD CONSTRAINT task_constitution_rules_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.task_constitution_rules
    ADD CONSTRAINT task_constitution_rules_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.constitution_rules(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.task_constitution_rules
    ADD CONSTRAINT task_constitution_rules_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.task_cycles
    ADD CONSTRAINT task_cycles_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.task_cycles
    ADD CONSTRAINT task_cycles_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.task_dependencies
    ADD CONSTRAINT task_dependencies_depends_on_task_id_fkey FOREIGN KEY (depends_on_task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.task_dependencies
    ADD CONSTRAINT task_dependencies_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.task_dependencies
    ADD CONSTRAINT task_dependencies_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.task_executions
    ADD CONSTRAINT task_executions_cycle_id_fkey FOREIGN KEY (cycle_id) REFERENCES public.task_cycles(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.task_executions
    ADD CONSTRAINT task_executions_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.task_executions
    ADD CONSTRAINT task_executions_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.task_relations
    ADD CONSTRAINT task_relations_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.task_relations
    ADD CONSTRAINT task_relations_related_task_id_fkey FOREIGN KEY (related_task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.task_relations
    ADD CONSTRAINT task_relations_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_parent_task_id_fkey FOREIGN KEY (parent_task_id) REFERENCES public.tasks(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_phase_id_fkey FOREIGN KEY (phase_id) REFERENCES public.phases(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.constitution_rule_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.constitution_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.constitution_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.constitutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.execution_position ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_description ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_description_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_execution_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resume_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.state_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_constitution_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their projects" ON public.projects TO authenticated USING ((owner_id = auth.uid())) WITH CHECK ((owner_id = auth.uid()));
CREATE POLICY "Project owners manage artifacts" ON public.artifacts TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = artifacts.project_id) AND (p.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = artifacts.project_id) AND (p.owner_id = auth.uid())))));
CREATE POLICY "Project owners manage checkpoints" ON public.checkpoints TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = checkpoints.project_id) AND (p.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = checkpoints.project_id) AND (p.owner_id = auth.uid())))));
CREATE POLICY "Project owners manage constitution_rule_history" ON public.constitution_rule_history TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = constitution_rule_history.project_id) AND (p.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = constitution_rule_history.project_id) AND (p.owner_id = auth.uid())))));
CREATE POLICY "Project owners manage constitution_rules" ON public.constitution_rules TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = constitution_rules.project_id) AND (p.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = constitution_rules.project_id) AND (p.owner_id = auth.uid())))));
CREATE POLICY "Project owners manage constitution_sections" ON public.constitution_sections TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = constitution_sections.project_id) AND (p.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = constitution_sections.project_id) AND (p.owner_id = auth.uid())))));
CREATE POLICY "Project owners manage constitutions" ON public.constitutions TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = constitutions.project_id) AND (p.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = constitutions.project_id) AND (p.owner_id = auth.uid())))));
CREATE POLICY "Project owners manage execution_logs" ON public.execution_logs TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = execution_logs.project_id) AND (p.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = execution_logs.project_id) AND (p.owner_id = auth.uid())))));
CREATE POLICY "Project owners manage execution_position" ON public.execution_position TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = execution_position.project_id) AND (p.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = execution_position.project_id) AND (p.owner_id = auth.uid())))));
CREATE POLICY "Project owners manage phases" ON public.phases TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = phases.project_id) AND (p.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = phases.project_id) AND (p.owner_id = auth.uid())))));
CREATE POLICY "Project owners manage project_decisions" ON public.project_decisions TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = project_decisions.project_id) AND (p.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = project_decisions.project_id) AND (p.owner_id = auth.uid())))));
CREATE POLICY "Project owners manage project_description" ON public.project_description TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = project_description.project_id) AND (p.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = project_description.project_id) AND (p.owner_id = auth.uid())))));
CREATE POLICY "Project owners manage project_description_history" ON public.project_description_history TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = project_description_history.project_id) AND (p.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = project_description_history.project_id) AND (p.owner_id = auth.uid())))));
CREATE POLICY "Project owners manage project_execution_summary" ON public.project_execution_summary TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = project_execution_summary.project_id) AND (p.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = project_execution_summary.project_id) AND (p.owner_id = auth.uid())))));
CREATE POLICY "Project owners manage resume_packages" ON public.resume_packages TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = resume_packages.project_id) AND (p.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = resume_packages.project_id) AND (p.owner_id = auth.uid())))));
CREATE POLICY "Project owners manage state_conflicts" ON public.state_conflicts TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = state_conflicts.project_id) AND (p.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = state_conflicts.project_id) AND (p.owner_id = auth.uid())))));
CREATE POLICY "Project owners manage task_artifacts" ON public.task_artifacts TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = task_artifacts.project_id) AND (p.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = task_artifacts.project_id) AND (p.owner_id = auth.uid())))));
CREATE POLICY "Project owners manage task_changes" ON public.task_changes TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = task_changes.project_id) AND (p.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = task_changes.project_id) AND (p.owner_id = auth.uid())))));
CREATE POLICY "Project owners manage task_constitution_rules" ON public.task_constitution_rules TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = task_constitution_rules.project_id) AND (p.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = task_constitution_rules.project_id) AND (p.owner_id = auth.uid())))));
CREATE POLICY "Project owners manage task_cycles" ON public.task_cycles TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = task_cycles.project_id) AND (p.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = task_cycles.project_id) AND (p.owner_id = auth.uid())))));
CREATE POLICY "Project owners manage task_dependencies" ON public.task_dependencies TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = task_dependencies.project_id) AND (p.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = task_dependencies.project_id) AND (p.owner_id = auth.uid())))));
CREATE POLICY "Project owners manage task_executions" ON public.task_executions TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = task_executions.project_id) AND (p.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = task_executions.project_id) AND (p.owner_id = auth.uid())))));
CREATE POLICY "Project owners manage task_relations" ON public.task_relations TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = task_relations.project_id) AND (p.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = task_relations.project_id) AND (p.owner_id = auth.uid())))));
CREATE POLICY "Project owners manage tasks" ON public.tasks TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = tasks.project_id) AND (p.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = tasks.project_id) AND (p.owner_id = auth.uid())))));
CREATE POLICY profiles_select_own ON public.profiles FOR SELECT TO authenticated USING (((id = auth.uid()) OR (manager_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'admin_staff'::public.app_role)));
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated USING (((id = auth.uid()) OR (manager_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role))) WITH CHECK (((id = auth.uid()) OR (manager_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role)));
CREATE POLICY user_roles_select ON public.user_roles FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR public.is_manager_of(auth.uid(), user_id) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'admin_staff'::public.app_role)));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.artifacts TO authenticated;
GRANT ALL ON public.artifacts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checkpoints TO authenticated;
GRANT ALL ON public.checkpoints TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.constitution_rule_history TO authenticated;
GRANT ALL ON public.constitution_rule_history TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.constitution_rules TO authenticated;
GRANT ALL ON public.constitution_rules TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.constitution_sections TO authenticated;
GRANT ALL ON public.constitution_sections TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.constitutions TO authenticated;
GRANT ALL ON public.constitutions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.execution_logs TO authenticated;
GRANT ALL ON public.execution_logs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.execution_position TO authenticated;
GRANT ALL ON public.execution_position TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.phases TO authenticated;
GRANT ALL ON public.phases TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_decisions TO authenticated;
GRANT ALL ON public.project_decisions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_description TO authenticated;
GRANT ALL ON public.project_description TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_description_history TO authenticated;
GRANT ALL ON public.project_description_history TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_execution_summary TO authenticated;
GRANT ALL ON public.project_execution_summary TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.resume_packages TO authenticated;
GRANT ALL ON public.resume_packages TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.state_conflicts TO authenticated;
GRANT ALL ON public.state_conflicts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_artifacts TO authenticated;
GRANT ALL ON public.task_artifacts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_changes TO authenticated;
GRANT ALL ON public.task_changes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_constitution_rules TO authenticated;
GRANT ALL ON public.task_constitution_rules TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_cycles TO authenticated;
GRANT ALL ON public.task_cycles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_dependencies TO authenticated;
GRANT ALL ON public.task_dependencies TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_executions TO authenticated;
GRANT ALL ON public.task_executions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_relations TO authenticated;
GRANT ALL ON public.task_relations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;