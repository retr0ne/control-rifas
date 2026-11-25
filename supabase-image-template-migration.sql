-- Ejecuta este archivo una sola vez en el SQL Editor de Supabase antes de publicar esta versión.
-- Las rifas existentes usarán la plantilla cálida por defecto.

alter table public.raffles
  add column if not exists image_template text not null default 'warm'
  check (image_template in ('warm', 'blue'));

update public.raffles
set image_template = 'warm'
where image_template is null;
