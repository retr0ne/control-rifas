-- Ejecuta este archivo una sola vez en el SQL Editor de Supabase.
-- Conserva todas las rifas y boletas existentes.

alter table public.raffles
  add column if not exists lottery text not null default 'Por definir';

alter table public.raffles
  add column if not exists is_finalized boolean not null default false;

alter table public.raffles
  add column if not exists finalized_at timestamptz;

update public.raffles
set lottery = 'Por definir'
where trim(coalesce(lottery, '')) = '';

-- No permite cerrar antes del sorteo ni reabrir una rifa cerrada.
create or replace function public.enforce_raffle_finalization()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.is_finalized and not new.is_finalized then
    raise exception 'Una rifa finalizada no puede reabrirse';
  end if;

  if not old.is_finalized and new.is_finalized and now() < old.draw_date then
    raise exception 'No se puede finalizar una rifa antes de su fecha de sorteo';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_raffle_finalization_trigger on public.raffles;
create trigger enforce_raffle_finalization_trigger
before update on public.raffles
for each row execute function public.enforce_raffle_finalization();

-- Bloquea asignaciones, ediciones y eliminaciones de boletas al finalizar.
create or replace function public.prevent_finalized_raffle_ticket_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_raffle_id uuid;
  raffle_is_finalized boolean;
begin
  if tg_op = 'DELETE' then
    target_raffle_id := old.raffle_id;
  else
    target_raffle_id := new.raffle_id;
  end if;

  select is_finalized
  into raffle_is_finalized
  from public.raffles
  where id = target_raffle_id;

  if coalesce(raffle_is_finalized, false) then
    raise exception 'No se pueden modificar boletas de una rifa finalizada';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_finalized_raffle_ticket_changes_trigger on public.tickets;
create trigger prevent_finalized_raffle_ticket_changes_trigger
before insert or update or delete on public.tickets
for each row execute function public.prevent_finalized_raffle_ticket_changes();
