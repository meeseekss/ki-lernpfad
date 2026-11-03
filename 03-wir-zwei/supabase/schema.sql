-- Wir zwei · Datenbank-Schema für Supabase
-- Einmal komplett im Supabase-Dashboard unter „SQL Editor“ ausführen.
--
-- Grundregeln, die hier in der Datenbank erzwungen werden (nicht nur in der App):
--   * Jede Person sieht nur Daten aus ihrem eigenen Paar.
--   * Antworten können nur angelegt, nie geändert oder gelöscht werden.
--   * Die Antwort des anderen ist erst sichtbar, wenn man selbst geantwortet hat.
--   * Eine Frage für morgen sieht der andere erst ab morgen.
--   * Ein Paar hat höchstens zwei Mitglieder.

-- ───────────────────────── Tabellen ─────────────────────────

create table public.paare (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  erstellt_am timestamptz not null default now()
);

create table public.profile (
  id            uuid primary key references auth.users on delete cascade,
  paar_id       uuid references public.paare on delete set null,
  name          text not null check (char_length(name) between 1 and 30),
  stimmung      text check (stimmung in ('arm', 'gut', 'platt', 'down', 'gestresst', 'unproduktiv', 'abgefuckt', 'stimme')),
  stimmung_seit timestamptz
);

create table public.fragen (
  id          uuid primary key default gen_random_uuid(),
  paar_id     uuid not null references public.paare on delete cascade,
  autor       uuid not null references public.profile on delete cascade,
  tag         date not null,
  text        text not null check (char_length(text) between 3 and 200),
  erstellt_am timestamptz not null default now(),
  unique (autor, tag) -- jede Person stellt pro Tag genau eine Frage
);

create table public.antworten (
  frage_id    uuid not null references public.fragen on delete cascade,
  autor       uuid not null references public.profile on delete cascade,
  paar_id     uuid not null references public.paare on delete cascade,
  text        text not null check (char_length(text) between 1 and 500),
  erstellt_am timestamptz not null default now(),
  primary key (frage_id, autor) -- eine Antwort pro Person und Frage
);

create table public.eher_antworten (
  autor       uuid not null references public.profile on delete cascade,
  paar_id     uuid not null references public.paare on delete cascade,
  tag         date not null,
  wahl        smallint not null check (wahl in (0, 1)),
  erstellt_am timestamptz not null default now(),
  primary key (autor, tag)
);

create table public.gesten (
  id          bigint generated always as identity primary key,
  paar_id     uuid not null references public.paare on delete cascade,
  von         uuid not null references public.profile on delete cascade,
  art         text not null check (art in ('umarmung', 'anruf')),
  erstellt_am timestamptz not null default now()
);

create index on public.fragen (paar_id, tag);
create index on public.antworten (paar_id);
create index on public.eher_antworten (paar_id, tag);
create index on public.gesten (paar_id, erstellt_am);

-- ───────────────────────── Hilfsfunktionen ─────────────────────────
-- „security definer“ = läuft mit Rechten des Erstellers. So können die Zugriffsregeln
-- nachschauen, ohne sich selbst endlos erneut zu prüfen.

create function public.heute() returns date
language sql stable set search_path = public as $$
  select (now() at time zone 'Europe/Berlin')::date
$$;

create function public.mein_paar() returns uuid
language sql stable security definer set search_path = public as $$
  select paar_id from public.profile where id = auth.uid()
$$;

create function public.habe_beantwortet(p_frage uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.antworten where frage_id = p_frage and autor = auth.uid())
$$;

create function public.habe_eher_gewaehlt(p_tag date) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.eher_antworten where tag = p_tag and autor = auth.uid())
$$;

-- Verrät nur, OB der andere schon geantwortet hat – nie WAS.
create function public.partner_status() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'fragen', coalesce((
      select json_agg(a.frage_id)
      from public.antworten a
      join public.fragen f on f.id = a.frage_id
      where a.paar_id = public.mein_paar()
        and a.autor <> auth.uid()
        and f.tag >= public.heute() - 7
    ), '[]'::json),
    'eher_heute', exists (
      select 1 from public.eher_antworten
      where paar_id = public.mein_paar() and autor <> auth.uid() and tag = public.heute()
    )
  )
$$;

-- Neues Paar anlegen, gibt den Einladungscode zurück.
create function public.paar_erstellen(p_name text) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_code text;
  v_paar uuid;
  v_zeichen constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- ohne 0/O/1/I/L
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;
  if exists (select 1 from profile where id = auth.uid() and paar_id is not null) then
    raise exception 'Du bist schon in einem Paar';
  end if;
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_zeichen, 1 + floor(random() * length(v_zeichen))::int, 1);
    end loop;
    exit when not exists (select 1 from paare where code = v_code);
  end loop;
  insert into paare (code) values (v_code) returning id into v_paar;
  insert into profile (id, paar_id, name) values (auth.uid(), v_paar, trim(p_name))
    on conflict (id) do update set paar_id = excluded.paar_id, name = excluded.name;
  return v_code;
end
$$;

-- Mit einem Code einem bestehenden Paar beitreten.
create function public.paar_beitreten(p_code text, p_name text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_paar uuid;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;
  if exists (select 1 from profile where id = auth.uid() and paar_id is not null) then
    raise exception 'Du bist schon in einem Paar';
  end if;
  select id into v_paar from paare where code = upper(trim(p_code)) for update;
  if v_paar is null then
    raise exception 'Diesen Code gibt es nicht';
  end if;
  if (select count(*) from profile where paar_id = v_paar) >= 2 then
    raise exception 'Dieses Paar ist schon vollständig';
  end if;
  insert into profile (id, paar_id, name) values (auth.uid(), v_paar, trim(p_name))
    on conflict (id) do update set paar_id = excluded.paar_id, name = excluded.name;
end
$$;

revoke execute on function public.mein_paar(), public.habe_beantwortet(uuid), public.habe_eher_gewaehlt(date),
  public.partner_status(), public.paar_erstellen(text), public.paar_beitreten(text, text) from public, anon;
grant execute on function public.mein_paar(), public.habe_beantwortet(uuid), public.habe_eher_gewaehlt(date),
  public.partner_status(), public.paar_erstellen(text), public.paar_beitreten(text, text) to authenticated;

-- ───────────────────────── Zugriffsregeln (Row Level Security) ─────────────────────────

alter table public.paare          enable row level security;
alter table public.profile        enable row level security;
alter table public.fragen         enable row level security;
alter table public.antworten      enable row level security;
alter table public.eher_antworten enable row level security;
alter table public.gesten         enable row level security;

-- Ohne Anmeldung darf niemand etwas.
revoke all on public.paare, public.profile, public.fragen, public.antworten,
  public.eher_antworten, public.gesten from anon;

-- Angemeldete bekommen genau die Rechte, die die App braucht – nicht mehr.
-- (So funktioniert es auch, wenn „Automatically expose new tables“ ausgeschaltet ist.)
grant usage on schema public to authenticated;
grant select on public.paare, public.profile, public.fragen, public.antworten,
  public.eher_antworten, public.gesten to authenticated;
grant insert on public.fragen, public.antworten, public.eher_antworten, public.gesten to authenticated;
-- Rechte, die die App nie braucht (TRUNCATE würde die Zugriffsregeln umgehen).
revoke truncate, references, trigger on public.paare, public.profile, public.fragen,
  public.antworten, public.eher_antworten, public.gesten from authenticated;

-- Paare: nur das eigene lesen. Anlegen nur über paar_erstellen().
create policy "eigenes Paar lesen" on public.paare
  for select to authenticated using (id = public.mein_paar());

-- Profile: sich selbst und den Partner lesen; nur Name und Stimmung ändern.
create policy "Profile im Paar lesen" on public.profile
  for select to authenticated using (id = auth.uid() or paar_id = public.mein_paar());
create policy "eigenes Profil ändern" on public.profile
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke insert, update, delete on public.profile from authenticated;
grant update (name, stimmung, stimmung_seit) on public.profile to authenticated;

-- Fragen: eigene immer, die des Partners erst ab ihrem Tag. Nur für heute oder morgen anlegen.
create policy "Fragen im Paar lesen" on public.fragen
  for select to authenticated
  using (paar_id = public.mein_paar() and (autor = auth.uid() or tag <= public.heute()));
create policy "eigene Frage anlegen" on public.fragen
  for insert to authenticated
  with check (
    autor = auth.uid()
    and paar_id = public.mein_paar()
    and tag between public.heute() and public.heute() + 1
  );

-- Antworten: eigene immer, die des Partners erst nach der eigenen. Kein Ändern, kein Löschen.
create policy "Antworten lesen" on public.antworten
  for select to authenticated
  using (autor = auth.uid() or (paar_id = public.mein_paar() and public.habe_beantwortet(frage_id)));
create policy "eigene Antwort anlegen" on public.antworten
  for insert to authenticated
  with check (
    autor = auth.uid()
    and paar_id = public.mein_paar()
    and exists (
      select 1 from public.fragen f
      where f.id = frage_id and f.paar_id = public.mein_paar() and f.tag <= public.heute()
    )
  );

-- „Was würdest du eher?“: gleiche Regeln, nur für den heutigen Tag.
create policy "Eher-Antworten lesen" on public.eher_antworten
  for select to authenticated
  using (autor = auth.uid() or (paar_id = public.mein_paar() and public.habe_eher_gewaehlt(tag)));
create policy "eigene Eher-Antwort anlegen" on public.eher_antworten
  for insert to authenticated
  with check (autor = auth.uid() and paar_id = public.mein_paar() and tag = public.heute());

-- Gesten (Umarmung, „ich ruf dich an“): im Paar lesen und senden.
create policy "Gesten lesen" on public.gesten
  for select to authenticated using (paar_id = public.mein_paar());
create policy "Geste senden" on public.gesten
  for insert to authenticated with check (von = auth.uid() and paar_id = public.mein_paar());

-- Ändern und Löschen bleibt für alle Inhalte gesperrt (es gibt bewusst keine Regel dafür).
revoke update, delete on public.fragen, public.antworten, public.eher_antworten, public.gesten from authenticated;

-- ───────────────────────── Echtzeit ─────────────────────────
-- Damit Änderungen sofort beim anderen ankommen.

alter publication supabase_realtime add table
  public.profile, public.fragen, public.antworten, public.eher_antworten, public.gesten;

-- ───────────────────────── Push-Mitteilungen ─────────────────────────
-- Ein Eintrag pro Gerät, auf dem Mitteilungen eingeschaltet sind.

create table public.push_abos (
  endpoint    text primary key,
  nutzer      uuid not null default auth.uid() references public.profile on delete cascade,
  p256dh      text not null,
  auth        text not null,
  erstellt_am timestamptz not null default now()
);
create index on public.push_abos (nutzer);

alter table public.push_abos enable row level security;
revoke all on public.push_abos from anon, authenticated;
grant select, insert, delete on public.push_abos to authenticated;

create policy "eigene Geräte lesen" on public.push_abos
  for select to authenticated using (nutzer = auth.uid());
create policy "eigenes Gerät anmelden" on public.push_abos
  for insert to authenticated with check (nutzer = auth.uid());
create policy "eigenes Gerät abmelden" on public.push_abos
  for delete to authenticated using (nutzer = auth.uid());

-- Schlüsselpaar für Web Push (VAPID). Nur die Edge Function (service_role) kommt dran.
-- Befüllen: einmal ein Schlüsselpaar erzeugen (z. B. `npx web-push generate-vapid-keys`) und
--   insert into public.push_schluessel (oeffentlich, privat) values ('<öffentlich>', '<privat>');
-- Den öffentlichen Schlüssel zusätzlich in js/konfig.js eintragen.
create table public.push_schluessel (
  id          int primary key default 1 check (id = 1),
  oeffentlich text not null,
  privat      text not null,
  -- Geheimnis, mit dem sich der tägliche Job bei der Edge Function ausweist
  cron_geheimnis text not null default encode(extensions.gen_random_bytes(24), 'hex')
);
alter table public.push_schluessel enable row level security;
revoke all on public.push_schluessel from anon, authenticated;

-- Die Edge Function „push“ arbeitet mit der Server-Rolle. Sie braucht genau diese Rechte.
-- (Nötig, weil „Automatically expose new tables“ ausgeschaltet ist.)
grant select on public.push_schluessel to service_role;
grant select, delete on public.push_abos to service_role;
grant select on public.profile, public.fragen to service_role;

-- ───────────────────────── Fragen für morgen um 8 Uhr melden ─────────────────────────
-- pg_cron rechnet in UTC. Der Job läuft um 6 und 7 Uhr UTC und sendet nur, wenn es in
-- Berlin 8 Uhr ist (Sommerzeit: 6 Uhr UTC, Winterzeit: 7 Uhr UTC).
-- <PROJEKT> und <ANON-SCHLÜSSEL> beim Einrichten ersetzen.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create or replace function public.fragen_des_tages_melden(p_immer boolean default false) returns bigint
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not p_immer and extract(hour from now() at time zone 'Europe/Berlin') <> 8 then
    return null;
  end if;
  return net.http_post(
    url := 'https://<PROJEKT>.supabase.co/functions/v1/push',
    body := '{"art":"geplante-fragen"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <ANON-SCHLÜSSEL>',
      'x-wir-zwei-cron', (select cron_geheimnis from public.push_schluessel where id = 1)),
    timeout_milliseconds := 30000);
end
$$;
revoke execute on function public.fragen_des_tages_melden(boolean) from public, anon, authenticated;

select cron.schedule('fragen-um-8', '0 6,7 * * *', 'select public.fragen_des_tages_melden()');
-- Zum Ausprobieren sofort auslösen: select public.fragen_des_tages_melden(true);

-- ───────────────────────── Foto des Tages (BeReal-Stil) ─────────────────────────
-- Ein Eintrag pro Person und Tag. Die Bilder liegen im privaten Storage-Bucket „fotos“
-- unter <paar_id>/<tag>/<nutzer>-hinten.jpg und <nutzer>-vorne.jpg.
-- Sichtbar nur im eigenen Paar und nur am selben Tag; stündlich räumt ein Job alte Tage weg.

create table public.fotos (
  autor       uuid not null default auth.uid() references public.profile on delete cascade,
  paar_id     uuid not null references public.paare on delete cascade,
  tag         date not null default public.heute(),
  erstellt_am timestamptz not null default now(),
  primary key (autor, tag)
);

alter table public.fotos enable row level security;
revoke all on public.fotos from anon, authenticated;
grant select, insert on public.fotos to authenticated;
grant select, delete on public.fotos to service_role;
grant select on public.paare to service_role;

create policy "Fotos im Paar heute ansehen" on public.fotos
  for select to authenticated
  using (paar_id = public.mein_paar() and tag = public.heute());

-- Posten geht nur, wenn beide Bilder schon hochgeladen sind.
create policy "eigenes Foto posten" on public.fotos
  for insert to authenticated
  with check (
    autor = auth.uid()
    and paar_id = public.mein_paar()
    and tag = public.heute()
    and exists (select 1 from storage.objects o where o.bucket_id = 'fotos'
                and o.name = paar_id::text || '/' || tag::text || '/' || auth.uid()::text || '-hinten.jpg')
    and exists (select 1 from storage.objects o where o.bucket_id = 'fotos'
                and o.name = paar_id::text || '/' || tag::text || '/' || auth.uid()::text || '-vorne.jpg')
  );

alter publication supabase_realtime add table public.fotos;

-- Privater Bucket, nur JPEG, höchstens 3 MB pro Bild.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', false, 3145728, array['image/jpeg'])
on conflict (id) do nothing;

-- Hat diese Person heute schon gepostet? (Danach lassen sich die Bilder nicht mehr ersetzen.)
create function public.foto_gepostet() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.fotos where autor = auth.uid() and tag = public.heute())
$$;
revoke execute on function public.foto_gepostet() from public, anon;
grant execute on function public.foto_gepostet() to authenticated;

create policy "Fotos im Paar heute laden" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'fotos'
    and (storage.foldername(name))[1] = public.mein_paar()::text
    and (storage.foldername(name))[2] = public.heute()::text
  );

create policy "eigene Fotos hochladen" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'fotos'
    and (storage.foldername(name))[1] = public.mein_paar()::text
    and (storage.foldername(name))[2] = public.heute()::text
    and storage.filename(name) in (auth.uid()::text || '-hinten.jpg', auth.uid()::text || '-vorne.jpg')
    and not public.foto_gepostet()
  );

-- Ersetzen (z. B. „Nochmal“ nach einem abgebrochenen Upload) nur, solange noch nicht gepostet.
create policy "eigene Fotos ersetzen" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'fotos'
    and (storage.foldername(name))[1] = public.mein_paar()::text
    and (storage.foldername(name))[2] = public.heute()::text
    and storage.filename(name) in (auth.uid()::text || '-hinten.jpg', auth.uid()::text || '-vorne.jpg')
    and not public.foto_gepostet()
  );

-- Stündlich alte Fotos löschen (Edge Function „aufraeumen“; direktes Löschen aus storage.objects
-- erlaubt Supabase nicht, deshalb über die Storage-API). <PROJEKT>/<ANON-SCHLÜSSEL> ersetzen.
create or replace function public.fotos_aufraeumen() returns bigint
language plpgsql security definer set search_path = public, extensions as $$
begin
  return net.http_post(
    url := 'https://<PROJEKT>.supabase.co/functions/v1/aufraeumen',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <ANON-SCHLÜSSEL>',
      'x-wir-zwei-cron', (select cron_geheimnis from public.push_schluessel where id = 1)),
    timeout_milliseconds := 60000);
end
$$;
revoke execute on function public.fotos_aufraeumen() from public, anon, authenticated;

select cron.schedule('fotos-aufraeumen', '1 * * * *', 'select public.fotos_aufraeumen()');

-- ───────────────────────── Seit wann zusammen ─────────────────────────
-- Für die dezente Zeile unter „Heute“. Beide im Paar dürfen das Datum ändern (nur diese Spalte).
alter table public.paare add column zusammen_seit date check (zusammen_seit <= public.heute() + 1);

grant update (zusammen_seit) on public.paare to authenticated;
create policy "eigenes Paar ändern" on public.paare
  for update to authenticated using (id = public.mein_paar()) with check (id = public.mein_paar());

alter publication supabase_realtime add table public.paare;
