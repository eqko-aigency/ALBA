-- Performance: el advisor de Supabase (get_advisors, type=performance) marcó dos
-- problemas reales en TODA la base, consistentes con la queja de la clienta de
-- que la app "sigue lentísima" incluso después del fix de doble round-trip de Auth
-- (ver apps/web/src/lib/repository.ts) y de confirmar que la región de Vercel
-- (pdx1) ya está bien co-ubicada con la de Supabase (us-west-2).
--
-- 1) auth_rls_initplan (50 policies): usar `auth.uid()` suelto dentro de una
--    policy RLS hace que Postgres re-evalúe esa función por cada fila evaluada,
--    en vez de una sola vez por consulta. Envolverlo en `(select auth.uid())`
--    deja que el planner lo trate como un InitPlan (se evalúa una vez). Mismo
--    comportamiento de seguridad, mucho más rápido a medida que crecen las
--    tablas. No se toca la función is_family_member() (no fue señalada por el
--    advisor — Postgres no la inlinea de la misma forma al ser SECURITY
--    DEFINER) ni la policy de profiles que la usa.
--
-- 2) unindexed_foreign_keys (35 FKs): columnas de FK sin índice de respaldo
--    fuerzan sequential scan en cada join/filtro por esa columna — empeora
--    progresivamente con el volumen de datos. Se agregan los 35 índices
--    exactos que señaló el advisor (los que ya tenían índice, ej. por ser PK o
--    por una migración previa, no están en esta lista).
--
-- Ambos cambios son no-destructivos: ALTER POLICY reemplaza la expresión de la
-- policy existente sin ventana sin RLS, y los índices son CREATE INDEX IF NOT
-- EXISTS puro agregado.

-- === 1) RLS: envolver auth.uid() en (select auth.uid()) ===

alter policy "chat_threads: miembros de la familia crean hilos" on public.chat_threads
  with check (
    (created_by = (select auth.uid()))
    and (exists (select 1 from family_members m where ((m.family_id = chat_threads.family_id) and (m.parent_id = (select auth.uid())))))
  );

alter policy "chat_threads: miembros de la familia renombran sus hilos" on public.chat_threads
  using (exists (select 1 from family_members m where ((m.family_id = chat_threads.family_id) and (m.parent_id = (select auth.uid())))));

alter policy "chat_threads: miembros de la familia ven sus hilos" on public.chat_threads
  using (exists (select 1 from family_members m where ((m.family_id = chat_threads.family_id) and (m.parent_id = (select auth.uid())))));

alter policy "children: miembros de la familia pueden actualizar" on public.children
  using (exists (select 1 from family_members m where ((m.family_id = children.family_id) and (m.parent_id = (select auth.uid())))));

alter policy "children: miembros de la familia pueden agregar hijos" on public.children
  with check (exists (select 1 from family_members m where ((m.family_id = children.family_id) and (m.parent_id = (select auth.uid())))));

alter policy "children: visibles para miembros de la familia" on public.children
  using (exists (select 1 from family_members m where ((m.family_id = children.family_id) and (m.parent_id = (select auth.uid())))));

alter policy "custody_agreements: miembros de la familia actualizan su conven" on public.custody_agreements
  using (exists (select 1 from family_members m where ((m.family_id = custody_agreements.family_id) and (m.parent_id = (select auth.uid())))));

alter policy "custody_agreements: miembros de la familia crean su convenio" on public.custody_agreements
  with check (exists (select 1 from family_members m where ((m.family_id = custody_agreements.family_id) and (m.parent_id = (select auth.uid())))));

alter policy "custody_agreements: miembros de la familia leen su convenio" on public.custody_agreements
  using (exists (select 1 from family_members m where ((m.family_id = custody_agreements.family_id) and (m.parent_id = (select auth.uid())))));

alter policy "custody_events: el progenitor dueño actualiza su propio evento" on public.custody_events
  using (parent_id = (select auth.uid()));

alter policy "custody_events: el progenitor dueño confirma su propio evento" on public.custody_events
  with check (parent_id = (select auth.uid()));

alter policy "custody_events: miembros de la familia leen eventos" on public.custody_events
  using (exists (
    select 1 from (children c join family_members m on ((m.family_id = c.family_id)))
    where ((c.id = custody_events.child_id) and (m.parent_id = (select auth.uid())))
  ));

alter policy "custody_slots: miembros de la familia borran slots" on public.custody_slots
  using (exists (
    select 1 from (custody_agreements a join family_members m on ((m.family_id = a.family_id)))
    where ((a.id = custody_slots.agreement_id) and (m.parent_id = (select auth.uid())))
  ));

alter policy "custody_slots: miembros de la familia crean slots" on public.custody_slots
  with check (exists (
    select 1 from (custody_agreements a join family_members m on ((m.family_id = a.family_id)))
    where ((a.id = custody_slots.agreement_id) and (m.parent_id = (select auth.uid())))
  ));

alter policy "custody_slots: miembros de la familia leen los slots" on public.custody_slots
  using (exists (
    select 1 from (custody_agreements a join family_members m on ((m.family_id = a.family_id)))
    where ((a.id = custody_slots.agreement_id) and (m.parent_id = (select auth.uid())))
  ));

alter policy "custody_visits: miembros de la familia borran visitas" on public.custody_visits
  using (exists (select 1 from family_members m where ((m.family_id = custody_visits.family_id) and (m.parent_id = (select auth.uid())))));

alter policy "custody_visits: miembros de la familia crean visitas" on public.custody_visits
  with check (
    (parent_id = (select auth.uid()))
    and (exists (select 1 from family_members m where ((m.family_id = custody_visits.family_id) and (m.parent_id = (select auth.uid())))))
  );

alter policy "custody_visits: miembros de la familia leen sus visitas" on public.custody_visits
  using (exists (select 1 from family_members m where ((m.family_id = custody_visits.family_id) and (m.parent_id = (select auth.uid())))));

alter policy "documents: miembros de la familia leen los documentos" on public.documents
  using (exists (select 1 from family_members m where ((m.family_id = documents.family_id) and (m.parent_id = (select auth.uid())))));

alter policy "documents: miembros de la familia suben documentos" on public.documents
  with check (
    (uploaded_by_parent_id = (select auth.uid()))
    and (exists (select 1 from family_members m where ((m.family_id = documents.family_id) and (m.parent_id = (select auth.uid())))))
  );

alter policy "expenses: el progenitor que no pagó aprueba o rechaza" on public.expenses
  using (
    (paid_by_parent_id <> (select auth.uid()))
    and (exists (
      select 1 from (children c join family_members m on ((m.family_id = c.family_id)))
      where ((c.id = expenses.child_id) and (m.parent_id = (select auth.uid())))
    ))
  );

alter policy "expenses: miembros de la familia leen los gastos" on public.expenses
  using (exists (
    select 1 from (children c join family_members m on ((m.family_id = c.family_id)))
    where ((c.id = expenses.child_id) and (m.parent_id = (select auth.uid())))
  ));

alter policy "expenses: miembros de la familia registran gastos" on public.expenses
  with check (
    (paid_by_parent_id = (select auth.uid()))
    and (exists (
      select 1 from (children c join family_members m on ((m.family_id = c.family_id)))
      where ((c.id = expenses.child_id) and (m.parent_id = (select auth.uid())))
    ))
  );

alter policy "families: cualquier usuario autenticado puede crear una" on public.families
  with check (created_by = (select auth.uid()));

alter policy "families: miembros pueden ver su familia" on public.families
  using (exists (select 1 from family_members m where ((m.family_id = families.id) and (m.parent_id = (select auth.uid())))));

alter policy "family_members: miembros ven a los demás miembros de su famili" on public.family_members
  using ((parent_id = (select auth.uid())) or is_family_member(family_id));

alter policy "important_dates: miembros de la familia borran fechas" on public.important_dates
  using (exists (select 1 from family_members m where ((m.family_id = important_dates.family_id) and (m.parent_id = (select auth.uid())))));

alter policy "important_dates: miembros de la familia crean fechas" on public.important_dates
  with check (
    (created_by_parent_id = (select auth.uid()))
    and (exists (select 1 from family_members m where ((m.family_id = important_dates.family_id) and (m.parent_id = (select auth.uid())))))
  );

alter policy "important_dates: miembros de la familia leen sus fechas" on public.important_dates
  using (exists (select 1 from family_members m where ((m.family_id = important_dates.family_id) and (m.parent_id = (select auth.uid())))));

alter policy "invitations: miembros de la familia pueden invitar" on public.invitations
  with check (
    (created_by = (select auth.uid()))
    and (exists (select 1 from family_members m where ((m.family_id = invitations.family_id) and (m.parent_id = (select auth.uid())))))
  );

alter policy "invitations: miembros de la familia ven sus invitaciones" on public.invitations
  using (exists (select 1 from family_members m where ((m.family_id = invitations.family_id) and (m.parent_id = (select auth.uid())))));

alter policy "meeting_places: miembros de la familia actualizan lugares" on public.meeting_places
  using (exists (select 1 from family_members m where ((m.family_id = meeting_places.family_id) and (m.parent_id = (select auth.uid())))));

alter policy "meeting_places: miembros de la familia borran lugares" on public.meeting_places
  using (exists (select 1 from family_members m where ((m.family_id = meeting_places.family_id) and (m.parent_id = (select auth.uid())))));

alter policy "meeting_places: miembros de la familia crean lugares" on public.meeting_places
  with check (exists (select 1 from family_members m where ((m.family_id = meeting_places.family_id) and (m.parent_id = (select auth.uid())))));

alter policy "meeting_places: miembros de la familia leen sus lugares" on public.meeting_places
  using (exists (select 1 from family_members m where ((m.family_id = meeting_places.family_id) and (m.parent_id = (select auth.uid())))));

alter policy "messages: miembros de la familia envían mensajes" on public.messages
  with check (
    (sender_id = (select auth.uid()))
    and (exists (
      select 1 from (chat_threads t join family_members m on ((m.family_id = t.family_id)))
      where ((t.id = messages.thread_id) and (m.parent_id = (select auth.uid())))
    ))
  );

alter policy "messages: miembros de la familia leen sus mensajes" on public.messages
  using (exists (
    select 1 from (chat_threads t join family_members m on ((m.family_id = t.family_id)))
    where ((t.id = messages.thread_id) and (m.parent_id = (select auth.uid())))
  ));

alter policy "pension_payments: el pagador registra su propio pago" on public.pension_payments
  with check (
    (paid_by_parent_id = (select auth.uid()))
    and (exists (select 1 from family_members m where ((m.family_id = pension_payments.family_id) and (m.parent_id = (select auth.uid())))))
  );

alter policy "pension_payments: miembros de la familia leen los pagos" on public.pension_payments
  using (exists (select 1 from family_members m where ((m.family_id = pension_payments.family_id) and (m.parent_id = (select auth.uid())))));

alter policy "pension_settings: miembros de la familia la actualizan" on public.pension_settings
  using (exists (select 1 from family_members m where ((m.family_id = pension_settings.family_id) and (m.parent_id = (select auth.uid())))));

alter policy "pension_settings: miembros de la familia la crean" on public.pension_settings
  with check (exists (select 1 from family_members m where ((m.family_id = pension_settings.family_id) and (m.parent_id = (select auth.uid())))));

alter policy "pension_settings: miembros de la familia leen su configuración" on public.pension_settings
  using (exists (select 1 from family_members m where ((m.family_id = pension_settings.family_id) and (m.parent_id = (select auth.uid())))));

alter policy "profiles: dueño actualiza su propio perfil" on public.profiles
  using ((select auth.uid()) = id);

alter policy "profiles: dueño lee su propio perfil" on public.profiles
  using ((select auth.uid()) = id);

alter policy "profiles: el usuario crea su propio perfil" on public.profiles
  with check ((select auth.uid()) = id);

alter policy "push_subscriptions: cada quien borra las suyas" on public.push_subscriptions
  using (parent_id = (select auth.uid()));

alter policy "push_subscriptions: cada quien crea las suyas" on public.push_subscriptions
  with check (parent_id = (select auth.uid()));

alter policy "push_subscriptions: cada quien ve sus propias suscripciones" on public.push_subscriptions
  using (parent_id = (select auth.uid()));

alter policy "verbal_agreements: miembros de la familia leen los acuerdos" on public.verbal_agreements
  using (exists (select 1 from family_members m where ((m.family_id = verbal_agreements.family_id) and (m.parent_id = (select auth.uid())))));

alter policy "verbal_agreements: miembros de la familia registran acuerdos" on public.verbal_agreements
  with check (
    (created_by_parent_id = (select auth.uid()))
    and (exists (select 1 from family_members m where ((m.family_id = verbal_agreements.family_id) and (m.parent_id = (select auth.uid())))))
  );

-- === 2) Índices faltantes para foreign keys (CREATE INDEX IF NOT EXISTS) ===

create index if not exists idx_chat_threads_child_id on public.chat_threads (child_id);
create index if not exists idx_chat_threads_created_by on public.chat_threads (created_by);
create index if not exists idx_chat_threads_pending_agreement_suggestion_based_on on public.chat_threads (pending_agreement_suggestion_based_on);
create index if not exists idx_children_family_id on public.children (family_id);
create index if not exists idx_custody_events_parent_id on public.custody_events (parent_id);
create index if not exists idx_custody_slots_agreement_id on public.custody_slots (agreement_id);
create index if not exists idx_custody_slots_child_id on public.custody_slots (child_id);
create index if not exists idx_custody_slots_parent_id on public.custody_slots (parent_id);
create index if not exists idx_custody_slots_place_id on public.custody_slots (place_id);
create index if not exists idx_custody_visits_child_id on public.custody_visits (child_id);
create index if not exists idx_custody_visits_family_id on public.custody_visits (family_id);
create index if not exists idx_custody_visits_parent_id on public.custody_visits (parent_id);
create index if not exists idx_custody_visits_place_id on public.custody_visits (place_id);
create index if not exists idx_documents_child_id on public.documents (child_id);
create index if not exists idx_documents_family_id on public.documents (family_id);
create index if not exists idx_documents_uploaded_by_parent_id on public.documents (uploaded_by_parent_id);
create index if not exists idx_expenses_child_id on public.expenses (child_id);
create index if not exists idx_expenses_paid_by_parent_id on public.expenses (paid_by_parent_id);
create index if not exists idx_families_created_by on public.families (created_by);
create index if not exists idx_important_dates_child_id on public.important_dates (child_id);
create index if not exists idx_important_dates_created_by_parent_id on public.important_dates (created_by_parent_id);
create index if not exists idx_important_dates_family_id on public.important_dates (family_id);
create index if not exists idx_invitations_created_by on public.invitations (created_by);
create index if not exists idx_invitations_family_id on public.invitations (family_id);
create index if not exists idx_meeting_places_family_id on public.meeting_places (family_id);
create index if not exists idx_messages_sender_id on public.messages (sender_id);
create index if not exists idx_messages_thread_id on public.messages (thread_id);
create index if not exists idx_pension_payments_confirmed_by_parent_id on public.pension_payments (confirmed_by_parent_id);
create index if not exists idx_pension_payments_paid_by_parent_id on public.pension_payments (paid_by_parent_id);
create index if not exists idx_pension_settings_payer_parent_id on public.pension_settings (payer_parent_id);
create index if not exists idx_push_subscriptions_parent_id on public.push_subscriptions (parent_id);
create index if not exists idx_verbal_agreements_child_id on public.verbal_agreements (child_id);
create index if not exists idx_verbal_agreements_confirmed_by_parent_id on public.verbal_agreements (confirmed_by_parent_id);
create index if not exists idx_verbal_agreements_created_by_parent_id on public.verbal_agreements (created_by_parent_id);
create index if not exists idx_verbal_agreements_family_id on public.verbal_agreements (family_id);
