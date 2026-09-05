-- La migración 0001 solo dejó SELECT e INSERT en children. Editar el perfil
-- de un hijo (nombre, fecha de nacimiento) requiere UPDATE para cualquier
-- progenitor vinculado, no solo para quien lo creó.

create policy "children: progenitores vinculados pueden actualizar"
  on public.children for update using (
    exists (
      select 1 from public.parent_child_links l
      where l.child_id = children.id and l.parent_id = auth.uid()
    )
  );
