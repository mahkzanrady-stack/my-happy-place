revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.rls_auto_enable() from public, anon, authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated;
revoke all on function public.get_resume_message(uuid) from public, anon;
grant execute on function public.get_resume_message(uuid) to authenticated, service_role;