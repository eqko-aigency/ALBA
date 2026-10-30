-- "Lugares de encuentro" pasa a poder describir una vacación: cada lugar
-- guardado gana campos opcionales de dirección/hotel/contactos/itinerario.
-- No se toca el nombre de la tabla/entidad (meeting_places sigue siendo el
-- selector de ubicación de Convenio y Visitas) — ver spec, sección 2.

alter table public.meeting_places
  add column if not exists address text,
  add column if not exists hotel_check_in date,
  add column if not exists hotel_check_out date,
  add column if not exists contacts text,
  add column if not exists itinerary text;
