-- Contraoferta (W-xx): "Expense.status" ya incluía 'countered' desde
-- 0010_gastos.sql, pero no había ningún campo para guardar la contraoferta
-- ni forma de resolverla. counter_amount_mxn es lo que el progenitor que
-- NO pagó ofrece CUBRIR (su reembolso) — no un monto alternativo para el
-- gasto completo.
--
-- Proponer la contraoferta (status -> 'countered' + los 3 campos nuevos)
-- ya lo permite la política de UPDATE existente ("expenses: el progenitor
-- que no pagó aprueba o rechaza", 0010_gastos.sql) — esa política no
-- restringe qué columnas se pueden cambiar, solo que el caller no sea
-- paid_by_parent_id, así que no hace falta tocarla.
--
-- Resolver la contraoferta SÍ es nuevo: esa misma política EXCLUYE a quien
-- pagó (paid_by_parent_id <> auth.uid()), y es justo quien pagó el que
-- necesita aceptar o rechazar. Necesita su propia función SECURITY
-- DEFINER, mismo criterio que confirm_pension_payment() en
-- 0016_pension.sql.

alter table public.expenses
  add column if not exists counter_amount_mxn numeric(12, 2) check (counter_amount_mxn is null or counter_amount_mxn > 0),
  add column if not exists counter_comment text,
  add column if not exists countered_by_parent_id uuid references public.profiles (id);

create or replace function public.resolve_expense_counter(p_expense_id uuid, p_accept boolean)
returns public.expenses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.expenses;
begin
  if auth.uid() is null then
    raise exception 'no hay sesión activa';
  end if;

  select * into v_row from public.expenses where id = p_expense_id;

  if v_row is null then
    raise exception 'gasto no encontrado';
  end if;

  if v_row.paid_by_parent_id <> auth.uid() then
    raise exception 'solo quien pagó el gasto puede resolver la contraoferta';
  end if;

  if v_row.status <> 'countered' then
    raise exception 'este gasto no tiene una contraoferta pendiente';
  end if;

  update public.expenses
  set status = case when p_accept then 'approved' else 'rejected' end
  where id = p_expense_id
  returning * into v_row;

  return v_row;
end;
$$;
