--
-- PostgreSQL database dump
--

-- \restrict 2MamsL147WTNhh1PkpXvYCtpeFhpinlNkGoL6aoWKFJQeKWjGmwqqTbU0mNiYnM

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
-- SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: image_gen; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA IF NOT EXISTS "image_gen";


ALTER SCHEMA "image_gen" OWNER TO "postgres";

--
-- Name: SCHEMA "public"; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA "public" IS 'standard public schema';


--
-- Name: smart_mail; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA IF NOT EXISTS "smart_mail";


ALTER SCHEMA "smart_mail" OWNER TO "postgres";

--
-- Name: pg_stat_statements; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";


--
-- Name: EXTENSION "pg_stat_statements"; Type: COMMENT; Schema: -; Owner:
--

-- COMMENT ON EXTENSION "pg_stat_statements" IS 'track planning and execution statistics of all SQL statements executed';


--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "extensions";


--
-- Name: EXTENSION "pg_trgm"; Type: COMMENT; Schema: -; Owner:
--

-- COMMENT ON EXTENSION "pg_trgm" IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";


--
-- Name: EXTENSION "pgcrypto"; Type: COMMENT; Schema: -; Owner:
--

-- COMMENT ON EXTENSION "pgcrypto" IS 'cryptographic functions';


--
-- Name: supabase_vault; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";


--
-- Name: EXTENSION "supabase_vault"; Type: COMMENT; Schema: -; Owner:
--

-- COMMENT ON EXTENSION "supabase_vault" IS 'Supabase Vault Extension';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner:
--

-- COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: vector; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public";


--
-- Name: EXTENSION "vector"; Type: COMMENT; Schema: -; Owner:
--

-- COMMENT ON EXTENSION "vector" IS 'vector data type and ivfflat and hnsw access methods';


--
-- Name: admin_update_profile("uuid", "text", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."admin_update_profile"("target_user_id" "uuid", "new_full_name" "text", "new_avatar_url" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  if not public.is_admin() then
    raise exception 'Acesso negado: Apenas administradores podem atualizar perfis.';
  end if;

  update public.profiles
    set full_name = coalesce(new_full_name, full_name),
        avatar_url = coalesce(new_avatar_url, avatar_url),
        updated_at = now()
  where id = target_user_id;
end;
$$;


ALTER FUNCTION "public"."admin_update_profile"("target_user_id" "uuid", "new_full_name" "text", "new_avatar_url" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";

--
-- Name: profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "updated_at" timestamp with time zone,
    "full_name" "text",
    "email" "text",
    "role" "text" DEFAULT 'member'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "avatar_url" "text",
    "tenant_id" "text",
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'manager'::"text", 'member'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";

--
-- Name: COLUMN "profiles"."tenant_id"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."profiles"."tenant_id" IS 'White-label tenant identifier. ENS=1 (cliente 1). Padrao: ens para perfis existentes.';


--
-- Name: admin_update_profile("uuid", "text", "text", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."admin_update_profile"("target_user_id" "uuid", "new_full_name" "text", "new_avatar_url" "text", "new_role" "text" DEFAULT NULL::"text") RETURNS "public"."profiles"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  actor_role text;
  next_role text;
  updated_profile public.profiles;
begin
  actor_role := public.current_app_profile_role();
  if actor_role <> 'admin' then
    raise exception 'admin_required';
  end if;

  next_role := coalesce(nullif(trim(new_role), ''), null);
  if next_role is not null and next_role not in ('admin', 'manager', 'member') then
    raise exception 'invalid_profile_role';
  end if;

  update public.profiles
  set
    full_name = new_full_name,
    avatar_url = new_avatar_url,
    role = coalesce(next_role, role),
    updated_at = now()
  where id = target_user_id
  returning * into updated_profile;

  if updated_profile.id is null then
    raise exception 'profile_not_found';
  end if;

  return updated_profile;
end;
$$;


ALTER FUNCTION "public"."admin_update_profile"("target_user_id" "uuid", "new_full_name" "text", "new_avatar_url" "text", "new_role" "text") OWNER TO "postgres";

--
-- Name: user_chat_integrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."user_chat_integrations" (
    "user_id" "uuid" NOT NULL,
    "hermes_enabled" boolean DEFAULT false NOT NULL,
    "hermes_base_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid",
    CONSTRAINT "user_chat_integrations_base_url_https_check" CHECK ((("hermes_base_url" IS NULL) OR ("btrim"("hermes_base_url") = ''::"text") OR ("hermes_base_url" ~ '^https://[^[:space:]]+$'::"text")))
);


ALTER TABLE "public"."user_chat_integrations" OWNER TO "postgres";

--
-- Name: admin_upsert_user_chat_integration("uuid", boolean, "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."admin_upsert_user_chat_integration"("target_user_id" "uuid", "new_hermes_enabled" boolean, "new_hermes_base_url" "text" DEFAULT NULL::"text") RETURNS "public"."user_chat_integrations"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
declare
  normalized_url text;
  result_row public.user_chat_integrations;
begin
  if not public.is_admin() then
    raise exception 'Acesso negado: apenas administradores podem configurar a integracao Hermes.';
  end if;

  normalized_url := nullif(btrim(coalesce(new_hermes_base_url, '')), '');

  if new_hermes_enabled and normalized_url is null then
    raise exception 'Informe uma base URL HTTPS valida para habilitar o endpoint Hermes personalizado.';
  end if;

  if normalized_url is not null and normalized_url !~ '^https://[^[:space:]]+$' then
    raise exception 'A base URL do Hermes deve usar HTTPS.';
  end if;

  insert into public.user_chat_integrations (
    user_id,
    hermes_enabled,
    hermes_base_url,
    updated_at,
    updated_by
  )
  values (
    target_user_id,
    new_hermes_enabled,
    case when new_hermes_enabled then normalized_url else null end,
    now(),
    auth.uid()
  )
  on conflict (user_id) do update
  set hermes_enabled = excluded.hermes_enabled,
      hermes_base_url = excluded.hermes_base_url,
      updated_at = now(),
      updated_by = auth.uid()
  returning * into result_row;

  return result_row;
end;
$_$;


ALTER FUNCTION "public"."admin_upsert_user_chat_integration"("target_user_id" "uuid", "new_hermes_enabled" boolean, "new_hermes_base_url" "text") OWNER TO "postgres";

--
-- Name: create_user_by_admin("text", "text", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."create_user_by_admin"("email" "text", "password" "text", "full_name" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  new_id uuid;
  admin_instance_id uuid;
  encrypted_pw text;
BEGIN
  -- 1. Validação de Permissão
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado: Apenas administradores podem criar usuários.';
  END IF;

  -- 2. Obter Instance ID (Necessário para multi-tenancy do Supabase, padrão é um UUID fixo ou nulo)
  SELECT instance_id INTO admin_instance_id FROM auth.users WHERE id = auth.uid();
  
  -- Fallback se não encontrar (comum em setups locais ou single-tenant)
  IF admin_instance_id IS NULL THEN
     SELECT instance_id INTO admin_instance_id FROM auth.users LIMIT 1;
  END IF;

  -- 3. Gerar ID e Hash de Senha
  new_id := gen_random_uuid();
  encrypted_pw := crypt(password, gen_salt('bf')); -- Requer extensão pgcrypto (já ativa no Supabase)

  -- 4. Inserir em auth.users
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    aud,
    role,
    created_at,
    updated_at,
    is_super_admin
  )
  VALUES (
    new_id,
    admin_instance_id,
    email,
    encrypted_pw,
    now(), -- Email confirmado automaticamente
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('full_name', full_name),
    'authenticated',
    'authenticated',
    now(),
    now(),
    false
  );

  -- 5. Inserir em auth.identities (Essencial para login funcionar)
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  )
  VALUES (
    gen_random_uuid(),
    new_id,
    jsonb_build_object('sub', new_id, 'email', email),
    'email',
    email,
    now(),
    now(),
    now()
  );

  -- 6. Inserir em public.profiles (Garantia de integridade)
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (new_id, full_name, email, 'user')
  ON CONFLICT (id) DO UPDATE
  SET full_name = excluded.full_name,
      email = excluded.email;

  RETURN new_id;
END;
$$;


ALTER FUNCTION "public"."create_user_by_admin"("email" "text", "password" "text", "full_name" "text") OWNER TO "postgres";

--
-- Name: current_app_profile_role(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."current_app_profile_role"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce(
    (
      select p.role
      from public.profiles p
      where p.id = auth.uid()
      limit 1
    ),
    'member'
  );
$$;


ALTER FUNCTION "public"."current_app_profile_role"() OWNER TO "postgres";

--
-- Name: delete_rag_chunks_by_file_id("text", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."delete_rag_chunks_by_file_id"("target_table" "text", "file_id" "text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
declare
  deleted_count integer;
begin
  if target_table not in ('rag_ens', 'rag_marketing') then
    raise exception 'invalid target_table: %', target_table;
  end if;

  execute format(
    'delete from public.%I where (metadata->>''file_id'') = $1',
    target_table
  )
  using file_id;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$_$;


ALTER FUNCTION "public"."delete_rag_chunks_by_file_id"("target_table" "text", "file_id" "text") OWNER TO "postgres";

--
-- Name: delete_user_by_admin("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."delete_user_by_admin"("target_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- 1. Validação de Permissão
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  -- 2. Prevenir Auto-Deleção
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode deletar sua própria conta.';
  END IF;

  -- 3. Deletar de auth.users (Cascade remove profiles e identities)
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;


ALTER FUNCTION "public"."delete_user_by_admin"("target_user_id" "uuid") OWNER TO "postgres";

--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), new.email),
    new.email,
    'member'
  )
  on conflict (id) do update
  set
    full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name),
    email = excluded.email,
    role = coalesce(public.profiles.role, 'member'),
    updated_at = now();

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";

--
-- Name: is_admin(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";

--
-- Name: kw_match_rag_ens("text", double precision, integer, "jsonb"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."kw_match_rag_ens"("query_text" "text", "match_threshold" double precision, "match_count" integer, "filter" "jsonb" DEFAULT '{}'::"jsonb") RETURNS TABLE("id" bigint, "content" "text", "metadata" "jsonb", "similarity" double precision)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    rag_ens.id,
    rag_ens.content,
    rag_ens.metadata,
    ts_rank_cd(to_tsvector('portuguese', rag_ens.content), websearch_to_tsquery('portuguese', query_text)) AS similarity
  FROM rag_ens
  WHERE to_tsvector('portuguese', rag_ens.content) @@ websearch_to_tsquery('portuguese', query_text)
  AND rag_ens.metadata @> filter
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;


ALTER FUNCTION "public"."kw_match_rag_ens"("query_text" "text", "match_threshold" double precision, "match_count" integer, "filter" "jsonb") OWNER TO "postgres";

--
-- Name: kw_match_rag_marketing("text", double precision, integer, "jsonb"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."kw_match_rag_marketing"("query_text" "text", "match_threshold" double precision, "match_count" integer, "filter" "jsonb" DEFAULT '{}'::"jsonb") RETURNS TABLE("id" bigint, "content" "text", "metadata" "jsonb", "similarity" double precision)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    rag_marketing.id,
    rag_marketing.content,
    rag_marketing.metadata,
    ts_rank_cd(to_tsvector('portuguese', rag_marketing.content), websearch_to_tsquery('portuguese', query_text)) AS similarity
  FROM rag_marketing
  WHERE to_tsvector('portuguese', rag_marketing.content) @@ websearch_to_tsquery('portuguese', query_text)
  AND rag_marketing.metadata @> filter
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;


ALTER FUNCTION "public"."kw_match_rag_marketing"("query_text" "text", "match_threshold" double precision, "match_count" integer, "filter" "jsonb") OWNER TO "postgres";

--
-- Name: match_rag_email_html("public"."vector", double precision, integer, "jsonb"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."match_rag_email_html"("query_embedding" "public"."vector", "match_threshold" double precision DEFAULT 0.1, "match_count" integer DEFAULT 10, "filter" "jsonb" DEFAULT '{}'::"jsonb") RETURNS TABLE("id" bigint, "content" "text", "metadata" "jsonb", "similarity" double precision)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        d.id,
        d.content,
        d.metadata,
        1 - (d.embedding <=> query_embedding) AS similarity
    FROM
        public.rag_email_html d
    WHERE
        1 - (d.embedding <=> query_embedding) > match_threshold
        AND d.metadata @> filter
    ORDER BY
        d.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;


ALTER FUNCTION "public"."match_rag_email_html"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter" "jsonb") OWNER TO "postgres";

--
-- Name: match_rag_ens("public"."vector", double precision, integer, "jsonb"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."match_rag_ens"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter" "jsonb" DEFAULT '{}'::"jsonb") RETURNS TABLE("id" bigint, "content" "text", "metadata" "jsonb", "similarity" double precision)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    rag_ens.id,
    rag_ens.content,
    rag_ens.metadata,
    1 - (rag_ens.embedding <=> query_embedding) AS similarity
  FROM rag_ens
  WHERE 1 - (rag_ens.embedding <=> query_embedding) > match_threshold
  AND rag_ens.metadata @> filter
  ORDER BY rag_ens.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;


ALTER FUNCTION "public"."match_rag_ens"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter" "jsonb") OWNER TO "postgres";

--
-- Name: match_rag_marketing("public"."vector", double precision, integer, "jsonb"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."match_rag_marketing"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter" "jsonb" DEFAULT '{}'::"jsonb") RETURNS TABLE("id" bigint, "content" "text", "metadata" "jsonb", "similarity" double precision)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    rag_marketing.id,
    rag_marketing.content,
    rag_marketing.metadata,
    1 - (rag_marketing.embedding <=> query_embedding) AS similarity
  FROM rag_marketing
  WHERE 1 - (rag_marketing.embedding <=> query_embedding) > match_threshold
  AND rag_marketing.metadata @> filter
  ORDER BY rag_marketing.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;


ALTER FUNCTION "public"."match_rag_marketing"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter" "jsonb") OWNER TO "postgres";

--
-- Name: touch_chat_session_hermes_state_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."touch_chat_session_hermes_state_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;


ALTER FUNCTION "public"."touch_chat_session_hermes_state_updated_at"() OWNER TO "postgres";

--
-- Name: touch_validated_works_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."touch_validated_works_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."touch_validated_works_updated_at"() OWNER TO "postgres";

--
-- Name: update_chat_session_message_count(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."update_chat_session_message_count"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        IF NEW.role = 'user' THEN
            UPDATE public.chat_sessions
            SET user_message_count = user_message_count + 1,
                updated_at = NOW()
            WHERE id = NEW.session_id;
        END IF;
    ELSIF (TG_OP = 'DELETE') THEN
        IF OLD.role = 'user' THEN
            UPDATE public.chat_sessions
            SET user_message_count = GREATEST(0, user_message_count - 1),
                updated_at = NOW()
            WHERE id = OLD.session_id;
        END IF;
    END IF;
    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_chat_session_message_count"() OWNER TO "postgres";

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

--
-- Name: set_updated_at(); Type: FUNCTION; Schema: smart_mail; Owner: postgres
--

CREATE OR REPLACE FUNCTION "smart_mail"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;


ALTER FUNCTION "smart_mail"."set_updated_at"() OWNER TO "postgres";

--
-- Name: job_items; Type: TABLE; Schema: image_gen; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "image_gen"."job_items" (
    "id" "uuid" NOT NULL,
    "job_id" "uuid" NOT NULL,
    "canal" "text" NOT NULL,
    "kv" "text" NOT NULL,
    "status" "text" NOT NULL,
    "file_url" "text",
    "storage_path" "text",
    "signed_url_expires_at" timestamp with time zone,
    "error" "text",
    "local_output_path" "text",
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "elapsed_seconds" numeric(10,3),
    CONSTRAINT "job_items_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'running'::"text", 'done'::"text", 'failed'::"text"])))
);


ALTER TABLE "image_gen"."job_items" OWNER TO "postgres";

--
-- Name: job_metrics; Type: TABLE; Schema: image_gen; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "image_gen"."job_metrics" (
    "job_id" "uuid" NOT NULL,
    "elapsed_seconds_total" numeric(10,3) DEFAULT 0 NOT NULL,
    "elapsed_seconds_by_channel" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "estimated_seconds_remaining" numeric(10,3) DEFAULT 0 NOT NULL,
    "estimated_completion_at" timestamp with time zone,
    "sampled_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "started_at" timestamp with time zone,
    "updated_at" timestamp with time zone
);


ALTER TABLE "image_gen"."job_metrics" OWNER TO "postgres";

--
-- Name: jobs; Type: TABLE; Schema: image_gen; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "image_gen"."jobs" (
    "id" "uuid" NOT NULL,
    "modo_geracao" "text" NOT NULL,
    "status" "text" NOT NULL,
    "briefing" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "kv" "text" NOT NULL,
    "requested_by" "uuid",
    "source_system" "text" DEFAULT 'nexus-designer-api'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "progress" "text",
    "file_url" "text",
    "error" "text",
    CONSTRAINT "jobs_modo_geracao_check" CHECK (("modo_geracao" = ANY (ARRAY['peca_unica'::"text", 'enxoval'::"text"]))),
    CONSTRAINT "jobs_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'running'::"text", 'done'::"text", 'partial_done'::"text", 'failed'::"text"])))
);


ALTER TABLE "image_gen"."jobs" OWNER TO "postgres";

--
-- Name: outputs; Type: TABLE; Schema: image_gen; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "image_gen"."outputs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "requested_by" "uuid",
    "canal" "text" NOT NULL,
    "kv" "text" NOT NULL,
    "storage_bucket" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "mime_type" "text" DEFAULT 'image/png'::"text" NOT NULL,
    "file_size_bytes" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "outputs_file_size_bytes_check" CHECK (("file_size_bytes" > 0))
);

ALTER TABLE ONLY "image_gen"."outputs" FORCE ROW LEVEL SECURITY;


ALTER TABLE "image_gen"."outputs" OWNER TO "postgres";

--
-- Name: ad_sets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ad_sets" (
    "id" "text" NOT NULL,
    "campaign_id" "text",
    "name" "text" NOT NULL,
    "status" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ad_sets" OWNER TO "postgres";

--
-- Name: ads; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ads" (
    "id" "text" NOT NULL,
    "ad_set_id" "text",
    "campaign_id" "text",
    "name" "text" NOT NULL,
    "status" "text",
    "creative_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ads" OWNER TO "postgres";

--
-- Name: agent_playbooks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."agent_playbooks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "system_scope" "text" DEFAULT 'smart_mail'::"text" NOT NULL,
    "agent_slug" "text" NOT NULL,
    "playbook_title" "text" NOT NULL,
    "playbook_text" "text" NOT NULL,
    "source_hash" "text" NOT NULL,
    "embedding_model" "text" DEFAULT 'text-embedding-3-large'::"text" NOT NULL,
    "embedding" "public"."vector"(3072) NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "agent_playbooks_agent_slug_check" CHECK (("char_length"(TRIM(BOTH FROM "agent_slug")) >= 2)),
    CONSTRAINT "agent_playbooks_embedding_model_check" CHECK (("embedding_model" = 'text-embedding-3-large'::"text")),
    CONSTRAINT "agent_playbooks_scope_check" CHECK (("system_scope" = 'smart_mail'::"text")),
    CONSTRAINT "agent_playbooks_source_hash_check" CHECK (("char_length"(TRIM(BOTH FROM "source_hash")) >= 16)),
    CONSTRAINT "agent_playbooks_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'deprecated'::"text"]))),
    CONSTRAINT "agent_playbooks_text_check" CHECK (("char_length"(TRIM(BOTH FROM "playbook_text")) >= 10)),
    CONSTRAINT "agent_playbooks_title_check" CHECK (("char_length"(TRIM(BOTH FROM "playbook_title")) >= 3))
);

ALTER TABLE ONLY "public"."agent_playbooks" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_playbooks" OWNER TO "postgres";

--
-- Name: chat_confidence_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."chat_confidence_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "confidence_score" numeric NOT NULL,
    "review_state" "text" NOT NULL,
    "avg_score" numeric,
    "iterations" integer DEFAULT 1 NOT NULL,
    "mode" "text",
    "answer_model" "text",
    "issues" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."chat_confidence_logs" OWNER TO "postgres";

--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."chat_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "chat_messages_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'assistant'::"text"])))
);


ALTER TABLE "public"."chat_messages" OWNER TO "postgres";

--
-- Name: chat_session_hermes_state; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."chat_session_hermes_state" (
    "chat_session_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "hermes_session_id" "text",
    "hermes_conversation_id" "text" NOT NULL,
    "last_response_id" "text",
    "last_good_response_id" "text",
    "chain_health" "text" DEFAULT 'healthy'::"text" NOT NULL,
    "last_error_code" "text",
    "last_error_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "chat_session_hermes_state_chain_health_check" CHECK (("chain_health" = ANY (ARRAY['healthy'::"text", 'degraded'::"text", 'recovering'::"text"])))
);


ALTER TABLE "public"."chat_session_hermes_state" OWNER TO "postgres";

--
-- Name: chat_session_summaries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."chat_session_summaries" (
    "session_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "summary" "text" DEFAULT ''::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_user_message_count" integer DEFAULT 0
);


ALTER TABLE "public"."chat_session_summaries" OWNER TO "postgres";

--
-- Name: chat_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."chat_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" DEFAULT 'Nova Conversa'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "user_message_count" integer DEFAULT 0
);


ALTER TABLE "public"."chat_sessions" OWNER TO "postgres";

--
-- Name: daily_metrics; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."daily_metrics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "account_id" "text" NOT NULL,
    "campaign_id" "text",
    "ad_id" "text",
    "report_date" "date" NOT NULL,
    "spend" numeric(10,2) DEFAULT 0,
    "impressions" integer DEFAULT 0,
    "clicks" integer DEFAULT 0,
    "leads" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."daily_metrics" OWNER TO "postgres";

--
-- Name: generated_images; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."generated_images" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "image_url" "text" NOT NULL,
    "prompt" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."generated_images" OWNER TO "postgres";

--
-- Name: graph_entities; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."graph_entities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "name_normalized" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."graph_entities" OWNER TO "postgres";

--
-- Name: graph_relations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."graph_relations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "from_entity_id" "uuid" NOT NULL,
    "to_entity_id" "uuid" NOT NULL,
    "relation_type" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."graph_relations" OWNER TO "postgres";

--
-- Name: ingestion_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ingestion_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source" "text" NOT NULL,
    "external_id" "text" NOT NULL,
    "file_hash" "text" NOT NULL,
    "last_modified" timestamp with time zone NOT NULL,
    "processed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'success'::"text" NOT NULL
);


ALTER TABLE "public"."ingestion_logs" OWNER TO "postgres";

--
-- Name: market_competitor_ads; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."market_competitor_ads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "competitor_id" "uuid" NOT NULL,
    "ad_library_id" "text",
    "platform" "text" DEFAULT 'meta'::"text" NOT NULL,
    "format" "text",
    "status" "text" DEFAULT 'active'::"text",
    "copy_text" "text",
    "headline" "text",
    "landing_page_url" "text",
    "thumbnail_url" "text",
    "started_at" timestamp with time zone,
    "ended_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."market_competitor_ads" OWNER TO "postgres";

--
-- Name: market_competitors; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."market_competitors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "name" "text" NOT NULL,
    "domain" "text",
    "brand_color" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."market_competitors" OWNER TO "postgres";

--
-- Name: market_intelligence_feed; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."market_intelligence_feed" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "severity" "text" DEFAULT 'medium'::"text",
    "is_read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."market_intelligence_feed" OWNER TO "postgres";

--
-- Name: market_trends; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."market_trends" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "term" "text" NOT NULL,
    "demand_score" integer DEFAULT 0,
    "competition_score" integer DEFAULT 0,
    "opportunity_score" integer GENERATED ALWAYS AS (("demand_score" - "competition_score")) STORED,
    "category" "text",
    "last_updated_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."market_trends" OWNER TO "postgres";

--
-- Name: rag_email_html; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."rag_email_html" (
    "id" bigint NOT NULL,
    "content" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "embedding" "public"."vector"(1536)
);


ALTER TABLE "public"."rag_email_html" OWNER TO "postgres";

--
-- Name: rag_email_html_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE "public"."rag_email_html" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."rag_email_html_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: rag_ens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."rag_ens" (
    "id" bigint NOT NULL,
    "content" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "embedding" "public"."vector"(1536)
);


ALTER TABLE "public"."rag_ens" OWNER TO "postgres";

--
-- Name: rag_ens_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE "public"."rag_ens" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."rag_ens_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: rag_marketing; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."rag_marketing" (
    "id" bigint NOT NULL,
    "content" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "embedding" "public"."vector"(1536)
);


ALTER TABLE "public"."rag_marketing" OWNER TO "postgres";

--
-- Name: rag_marketing_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE "public"."rag_marketing" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."rag_marketing_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: validated_works; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."validated_works" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" DEFAULT 'ens'::"text" NOT NULL,
    "artifact_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "status" "text" DEFAULT 'validated'::"text" NOT NULL,
    "related_course_id" "text",
    "related_course_title" "text",
    "related_rag_source_id" "text",
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_by_user_id" "uuid",
    "created_by_name" "text",
    "validated_by_user_id" "uuid",
    "validated_by_name" "text",
    "validated_at" timestamp with time zone,
    "deprecated_by_user_id" "uuid",
    "deprecated_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "validated_works_artifact_type_check" CHECK (("artifact_type" = ANY (ARRAY['copy'::"text", 'campanha'::"text", 'briefing'::"text", 'insight'::"text", 'decisao'::"text", 'prompt'::"text", 'estrategia'::"text"]))),
    CONSTRAINT "validated_works_content_check" CHECK ((("char_length"("content") >= 1) AND ("char_length"("content") <= 30000))),
    CONSTRAINT "validated_works_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'validated'::"text", 'deprecated'::"text"]))),
    CONSTRAINT "validated_works_title_check" CHECK ((("char_length"("title") >= 1) AND ("char_length"("title") <= 180)))
);


ALTER TABLE "public"."validated_works" OWNER TO "postgres";

--
-- Name: campaign_requests; Type: TABLE; Schema: smart_mail; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "smart_mail"."campaign_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "system_scope" "text" DEFAULT 'smart_mail'::"text" NOT NULL,
    "campaign_id" "uuid" NOT NULL,
    "lead_name" "text" NOT NULL,
    "lead_email" "text" NOT NULL,
    "company" "text",
    "message" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "campaign_requests_lead_email_check" CHECK (("lead_email" ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'::"text")),
    CONSTRAINT "campaign_requests_lead_name_check" CHECK (("char_length"(TRIM(BOTH FROM "lead_name")) >= 2)),
    CONSTRAINT "campaign_requests_message_check" CHECK (("char_length"(TRIM(BOTH FROM "message")) >= 5)),
    CONSTRAINT "campaign_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'processed'::"text", 'failed'::"text"]))),
    CONSTRAINT "campaign_requests_system_scope_check" CHECK (("system_scope" = 'smart_mail'::"text"))
);

ALTER TABLE ONLY "smart_mail"."campaign_requests" FORCE ROW LEVEL SECURITY;


ALTER TABLE "smart_mail"."campaign_requests" OWNER TO "postgres";

--
-- Name: knowledge_sources; Type: TABLE; Schema: smart_mail; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "smart_mail"."knowledge_sources" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "system_scope" "text" DEFAULT 'smart_mail'::"text" NOT NULL,
    "course_slug" "text" NOT NULL,
    "source_url" "text" NOT NULL,
    "source_kind" "text" NOT NULL,
    "source_hash" "text" NOT NULL,
    "chunk_id" "text" NOT NULL,
    "chunk_text" "text" NOT NULL,
    "evidence_map" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "confidence" numeric(5,4) NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "valid_from" timestamp with time zone,
    "valid_to" timestamp with time zone,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "knowledge_sources_confidence_check" CHECK ((("confidence" >= (0)::numeric) AND ("confidence" <= (1)::numeric))),
    CONSTRAINT "knowledge_sources_scope_check" CHECK (("system_scope" = 'smart_mail'::"text")),
    CONSTRAINT "knowledge_sources_source_kind_check" CHECK (("source_kind" = ANY (ARRAY['site'::"text", 'pdf'::"text", 'ementa'::"text", 'institucional'::"text"]))),
    CONSTRAINT "knowledge_sources_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'deprecated'::"text"])))
);

ALTER TABLE ONLY "smart_mail"."knowledge_sources" FORCE ROW LEVEL SECURITY;


ALTER TABLE "smart_mail"."knowledge_sources" OWNER TO "postgres";

--
-- Name: job_items job_items_pkey; Type: CONSTRAINT; Schema: image_gen; Owner: postgres
--

ALTER TABLE ONLY "image_gen"."job_items"
    ADD CONSTRAINT "job_items_pkey" PRIMARY KEY ("id");


--
-- Name: job_metrics job_metrics_pkey; Type: CONSTRAINT; Schema: image_gen; Owner: postgres
--

ALTER TABLE ONLY "image_gen"."job_metrics"
    ADD CONSTRAINT "job_metrics_pkey" PRIMARY KEY ("job_id");


--
-- Name: jobs jobs_pkey; Type: CONSTRAINT; Schema: image_gen; Owner: postgres
--

ALTER TABLE ONLY "image_gen"."jobs"
    ADD CONSTRAINT "jobs_pkey" PRIMARY KEY ("id");


--
-- Name: outputs outputs_item_id_key; Type: CONSTRAINT; Schema: image_gen; Owner: postgres
--

ALTER TABLE ONLY "image_gen"."outputs"
    ADD CONSTRAINT "outputs_item_id_key" UNIQUE ("item_id");


--
-- Name: outputs outputs_pkey; Type: CONSTRAINT; Schema: image_gen; Owner: postgres
--

ALTER TABLE ONLY "image_gen"."outputs"
    ADD CONSTRAINT "outputs_pkey" PRIMARY KEY ("id");


--
-- Name: outputs outputs_storage_path_key; Type: CONSTRAINT; Schema: image_gen; Owner: postgres
--

ALTER TABLE ONLY "image_gen"."outputs"
    ADD CONSTRAINT "outputs_storage_path_key" UNIQUE ("storage_path");


--
-- Name: ad_sets ad_sets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ad_sets"
    ADD CONSTRAINT "ad_sets_pkey" PRIMARY KEY ("id");


--
-- Name: ads ads_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ads"
    ADD CONSTRAINT "ads_pkey" PRIMARY KEY ("id");


--
-- Name: agent_playbooks agent_playbooks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."agent_playbooks"
    ADD CONSTRAINT "agent_playbooks_pkey" PRIMARY KEY ("id");


--
-- Name: agent_playbooks agent_playbooks_unique_source; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."agent_playbooks"
    ADD CONSTRAINT "agent_playbooks_unique_source" UNIQUE ("tenant_id", "system_scope", "agent_slug", "source_hash");


--
-- Name: chat_confidence_logs chat_confidence_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."chat_confidence_logs"
    ADD CONSTRAINT "chat_confidence_logs_pkey" PRIMARY KEY ("id");


--
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id");


--
-- Name: chat_session_hermes_state chat_session_hermes_state_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."chat_session_hermes_state"
    ADD CONSTRAINT "chat_session_hermes_state_pkey" PRIMARY KEY ("chat_session_id");


--
-- Name: chat_session_summaries chat_session_summaries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."chat_session_summaries"
    ADD CONSTRAINT "chat_session_summaries_pkey" PRIMARY KEY ("session_id");


--
-- Name: chat_sessions chat_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."chat_sessions"
    ADD CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id");


--
-- Name: daily_metrics daily_metrics_ad_id_report_date_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."daily_metrics"
    ADD CONSTRAINT "daily_metrics_ad_id_report_date_key" UNIQUE ("ad_id", "report_date");


--
-- Name: daily_metrics daily_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."daily_metrics"
    ADD CONSTRAINT "daily_metrics_pkey" PRIMARY KEY ("id");


--
-- Name: generated_images generated_images_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."generated_images"
    ADD CONSTRAINT "generated_images_pkey" PRIMARY KEY ("id");


--
-- Name: graph_entities graph_entities_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."graph_entities"
    ADD CONSTRAINT "graph_entities_pkey" PRIMARY KEY ("id");


--
-- Name: graph_relations graph_relations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."graph_relations"
    ADD CONSTRAINT "graph_relations_pkey" PRIMARY KEY ("id");


--
-- Name: ingestion_logs ingestion_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ingestion_logs"
    ADD CONSTRAINT "ingestion_logs_pkey" PRIMARY KEY ("id");


--
-- Name: market_competitor_ads market_competitor_ads_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."market_competitor_ads"
    ADD CONSTRAINT "market_competitor_ads_pkey" PRIMARY KEY ("id");


--
-- Name: market_competitors market_competitors_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."market_competitors"
    ADD CONSTRAINT "market_competitors_pkey" PRIMARY KEY ("id");


--
-- Name: market_intelligence_feed market_intelligence_feed_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."market_intelligence_feed"
    ADD CONSTRAINT "market_intelligence_feed_pkey" PRIMARY KEY ("id");


--
-- Name: market_trends market_trends_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."market_trends"
    ADD CONSTRAINT "market_trends_pkey" PRIMARY KEY ("id");


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");


--
-- Name: rag_email_html rag_email_html_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."rag_email_html"
    ADD CONSTRAINT "rag_email_html_pkey" PRIMARY KEY ("id");


--
-- Name: rag_ens rag_ens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."rag_ens"
    ADD CONSTRAINT "rag_ens_pkey" PRIMARY KEY ("id");


--
-- Name: rag_marketing rag_marketing_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."rag_marketing"
    ADD CONSTRAINT "rag_marketing_pkey" PRIMARY KEY ("id");


--
-- Name: user_chat_integrations user_chat_integrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_chat_integrations"
    ADD CONSTRAINT "user_chat_integrations_pkey" PRIMARY KEY ("user_id");


--
-- Name: validated_works validated_works_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."validated_works"
    ADD CONSTRAINT "validated_works_pkey" PRIMARY KEY ("id");


--
-- Name: campaign_requests campaign_requests_pkey; Type: CONSTRAINT; Schema: smart_mail; Owner: postgres
--

ALTER TABLE ONLY "smart_mail"."campaign_requests"
    ADD CONSTRAINT "campaign_requests_pkey" PRIMARY KEY ("id");


--
-- Name: knowledge_sources knowledge_sources_pkey; Type: CONSTRAINT; Schema: smart_mail; Owner: postgres
--

ALTER TABLE ONLY "smart_mail"."knowledge_sources"
    ADD CONSTRAINT "knowledge_sources_pkey" PRIMARY KEY ("id");


--
-- Name: idx_image_gen_outputs_created_at; Type: INDEX; Schema: image_gen; Owner: postgres
--

CREATE INDEX "idx_image_gen_outputs_created_at" ON "image_gen"."outputs" USING "btree" ("created_at" DESC);


--
-- Name: idx_image_gen_outputs_job_id; Type: INDEX; Schema: image_gen; Owner: postgres
--

CREATE INDEX "idx_image_gen_outputs_job_id" ON "image_gen"."outputs" USING "btree" ("job_id");


--
-- Name: idx_image_gen_outputs_requested_by; Type: INDEX; Schema: image_gen; Owner: postgres
--

CREATE INDEX "idx_image_gen_outputs_requested_by" ON "image_gen"."outputs" USING "btree" ("requested_by");


--
-- Name: idx_job_items_job_id; Type: INDEX; Schema: image_gen; Owner: postgres
--

CREATE INDEX "idx_job_items_job_id" ON "image_gen"."job_items" USING "btree" ("job_id", "canal");


--
-- Name: idx_job_items_status; Type: INDEX; Schema: image_gen; Owner: postgres
--

CREATE INDEX "idx_job_items_status" ON "image_gen"."job_items" USING "btree" ("status", "started_at");


--
-- Name: idx_jobs_requested_by; Type: INDEX; Schema: image_gen; Owner: postgres
--

CREATE INDEX "idx_jobs_requested_by" ON "image_gen"."jobs" USING "btree" ("requested_by", "created_at" DESC);


--
-- Name: idx_jobs_status; Type: INDEX; Schema: image_gen; Owner: postgres
--

CREATE INDEX "idx_jobs_status" ON "image_gen"."jobs" USING "btree" ("status", "created_at" DESC);


--
-- Name: agent_playbooks_embedding_hnsw_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "agent_playbooks_embedding_hnsw_idx" ON "public"."agent_playbooks" USING "hnsw" ((("embedding")::"public"."halfvec"(3072)) "public"."halfvec_cosine_ops");


--
-- Name: agent_playbooks_metadata_gin_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "agent_playbooks_metadata_gin_idx" ON "public"."agent_playbooks" USING "gin" ("metadata");


--
-- Name: agent_playbooks_status_created_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "agent_playbooks_status_created_idx" ON "public"."agent_playbooks" USING "btree" ("status", "created_at" DESC);


--
-- Name: agent_playbooks_tenant_scope_agent_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "agent_playbooks_tenant_scope_agent_idx" ON "public"."agent_playbooks" USING "btree" ("tenant_id", "system_scope", "agent_slug");


--
-- Name: chat_confidence_logs_session_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "chat_confidence_logs_session_idx" ON "public"."chat_confidence_logs" USING "btree" ("session_id");


--
-- Name: chat_confidence_logs_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "chat_confidence_logs_user_idx" ON "public"."chat_confidence_logs" USING "btree" ("user_id");


--
-- Name: chat_session_hermes_state_hermes_session_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "chat_session_hermes_state_hermes_session_id_idx" ON "public"."chat_session_hermes_state" USING "btree" ("hermes_session_id");


--
-- Name: chat_session_hermes_state_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "chat_session_hermes_state_user_id_idx" ON "public"."chat_session_hermes_state" USING "btree" ("user_id");


--
-- Name: chat_session_summaries_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "chat_session_summaries_user_id_idx" ON "public"."chat_session_summaries" USING "btree" ("user_id");


--
-- Name: graph_entities_name_type_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "graph_entities_name_type_idx" ON "public"."graph_entities" USING "btree" ("name_normalized", "entity_type");


--
-- Name: graph_entities_type_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "graph_entities_type_idx" ON "public"."graph_entities" USING "btree" ("entity_type");


--
-- Name: graph_relations_from_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "graph_relations_from_idx" ON "public"."graph_relations" USING "btree" ("from_entity_id");


--
-- Name: graph_relations_to_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "graph_relations_to_idx" ON "public"."graph_relations" USING "btree" ("to_entity_id");


--
-- Name: graph_relations_type_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "graph_relations_type_idx" ON "public"."graph_relations" USING "btree" ("relation_type");


--
-- Name: idx_ads_competitor; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ads_competitor" ON "public"."market_competitor_ads" USING "btree" ("competitor_id");


--
-- Name: idx_ads_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ads_created" ON "public"."market_competitor_ads" USING "btree" ("created_at" DESC);


--
-- Name: idx_ads_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ads_status" ON "public"."market_competitor_ads" USING "btree" ("status");


--
-- Name: idx_chat_messages_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_chat_messages_created_at" ON "public"."chat_messages" USING "btree" ("created_at");


--
-- Name: idx_chat_messages_session_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_chat_messages_session_id" ON "public"."chat_messages" USING "btree" ("session_id");


--
-- Name: idx_chat_sessions_updated_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_chat_sessions_updated_at" ON "public"."chat_sessions" USING "btree" ("updated_at" DESC);


--
-- Name: idx_chat_sessions_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_chat_sessions_user_id" ON "public"."chat_sessions" USING "btree" ("user_id");


--
-- Name: idx_competitors_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_competitors_user" ON "public"."market_competitors" USING "btree" ("user_id");


--
-- Name: idx_feed_user_unread; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_feed_user_unread" ON "public"."market_intelligence_feed" USING "btree" ("user_id") WHERE ("is_read" = false);


--
-- Name: idx_ingestion_logs_external_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ingestion_logs_external_id" ON "public"."ingestion_logs" USING "btree" ("external_id");


--
-- Name: idx_ingestion_logs_source; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ingestion_logs_source" ON "public"."ingestion_logs" USING "btree" ("source");


--
-- Name: idx_profiles_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_profiles_tenant_id" ON "public"."profiles" USING "btree" ("tenant_id");


--
-- Name: idx_profiles_tenant_id_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_profiles_tenant_id_id" ON "public"."profiles" USING "btree" ("tenant_id", "id");


--
-- Name: idx_rag_ens_content_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_rag_ens_content_trgm" ON "public"."rag_ens" USING "gin" ("content" "extensions"."gin_trgm_ops");


--
-- Name: idx_rag_marketing_content_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_rag_marketing_content_trgm" ON "public"."rag_marketing" USING "gin" ("content" "extensions"."gin_trgm_ops");


--
-- Name: idx_trends_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_trends_user" ON "public"."market_trends" USING "btree" ("user_id");


--
-- Name: rag_email_html_embedding_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "rag_email_html_embedding_idx" ON "public"."rag_email_html" USING "hnsw" ("embedding" "public"."vector_cosine_ops");


--
-- Name: rag_ens_embedding_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "rag_ens_embedding_idx" ON "public"."rag_ens" USING "hnsw" ("embedding" "public"."vector_cosine_ops");


--
-- Name: rag_marketing_embedding_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "rag_marketing_embedding_idx" ON "public"."rag_marketing" USING "hnsw" ("embedding" "public"."vector_cosine_ops");


--
-- Name: validated_works_course_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "validated_works_course_idx" ON "public"."validated_works" USING "btree" ("tenant_id", "related_course_title");


--
-- Name: validated_works_tags_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "validated_works_tags_idx" ON "public"."validated_works" USING "gin" ("tags");


--
-- Name: validated_works_tenant_status_type_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "validated_works_tenant_status_type_idx" ON "public"."validated_works" USING "btree" ("tenant_id", "status", "artifact_type", "validated_at" DESC);


--
-- Name: campaign_requests_campaign_idx; Type: INDEX; Schema: smart_mail; Owner: postgres
--

CREATE INDEX "campaign_requests_campaign_idx" ON "smart_mail"."campaign_requests" USING "btree" ("campaign_id");


--
-- Name: campaign_requests_metadata_gin_idx; Type: INDEX; Schema: smart_mail; Owner: postgres
--

CREATE INDEX "campaign_requests_metadata_gin_idx" ON "smart_mail"."campaign_requests" USING "gin" ("metadata");


--
-- Name: campaign_requests_tenant_created_idx; Type: INDEX; Schema: smart_mail; Owner: postgres
--

CREATE INDEX "campaign_requests_tenant_created_idx" ON "smart_mail"."campaign_requests" USING "btree" ("tenant_id", "created_at" DESC);


--
-- Name: knowledge_sources_evidence_map_gin_idx; Type: INDEX; Schema: smart_mail; Owner: postgres
--

CREATE INDEX "knowledge_sources_evidence_map_gin_idx" ON "smart_mail"."knowledge_sources" USING "gin" ("evidence_map");


--
-- Name: knowledge_sources_status_confidence_idx; Type: INDEX; Schema: smart_mail; Owner: postgres
--

CREATE INDEX "knowledge_sources_status_confidence_idx" ON "smart_mail"."knowledge_sources" USING "btree" ("status", "confidence" DESC);


--
-- Name: knowledge_sources_tenant_scope_course_idx; Type: INDEX; Schema: smart_mail; Owner: postgres
--

CREATE INDEX "knowledge_sources_tenant_scope_course_idx" ON "smart_mail"."knowledge_sources" USING "btree" ("tenant_id", "system_scope", "course_slug");


--
-- Name: chat_session_hermes_state touch_chat_session_hermes_state_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "touch_chat_session_hermes_state_updated_at" BEFORE UPDATE ON "public"."chat_session_hermes_state" FOR EACH ROW EXECUTE FUNCTION "public"."touch_chat_session_hermes_state_updated_at"();


--
-- Name: validated_works touch_validated_works_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "touch_validated_works_updated_at" BEFORE UPDATE ON "public"."validated_works" FOR EACH ROW EXECUTE FUNCTION "public"."touch_validated_works_updated_at"();


--
-- Name: agent_playbooks trg_agent_playbooks_set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_agent_playbooks_set_updated_at" BEFORE UPDATE ON "public"."agent_playbooks" FOR EACH ROW EXECUTE FUNCTION "smart_mail"."set_updated_at"();


--
-- Name: chat_sessions update_chat_sessions_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "update_chat_sessions_updated_at" BEFORE UPDATE ON "public"."chat_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();


--
-- Name: chat_messages update_message_count_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "update_message_count_trigger" AFTER INSERT OR DELETE ON "public"."chat_messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_chat_session_message_count"();


--
-- Name: campaign_requests trg_campaign_requests_set_updated_at; Type: TRIGGER; Schema: smart_mail; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_campaign_requests_set_updated_at" BEFORE UPDATE ON "smart_mail"."campaign_requests" FOR EACH ROW EXECUTE FUNCTION "smart_mail"."set_updated_at"();


--
-- Name: knowledge_sources trg_knowledge_sources_set_updated_at; Type: TRIGGER; Schema: smart_mail; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_knowledge_sources_set_updated_at" BEFORE UPDATE ON "smart_mail"."knowledge_sources" FOR EACH ROW EXECUTE FUNCTION "smart_mail"."set_updated_at"();


--
-- Name: job_items job_items_job_id_fkey; Type: FK CONSTRAINT; Schema: image_gen; Owner: postgres
--

ALTER TABLE ONLY "image_gen"."job_items"
    ADD CONSTRAINT "job_items_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "image_gen"."jobs"("id") ON DELETE CASCADE;


--
-- Name: job_metrics job_metrics_job_id_fkey; Type: FK CONSTRAINT; Schema: image_gen; Owner: postgres
--

ALTER TABLE ONLY "image_gen"."job_metrics"
    ADD CONSTRAINT "job_metrics_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "image_gen"."jobs"("id") ON DELETE CASCADE;


--
-- Name: ads ads_ad_set_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ads"
    ADD CONSTRAINT "ads_ad_set_id_fkey" FOREIGN KEY ("ad_set_id") REFERENCES "public"."ad_sets"("id") ON DELETE CASCADE;


--
-- Name: chat_confidence_logs chat_confidence_logs_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."chat_confidence_logs"
    ADD CONSTRAINT "chat_confidence_logs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE CASCADE;


--
-- Name: chat_confidence_logs chat_confidence_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."chat_confidence_logs"
    ADD CONSTRAINT "chat_confidence_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: chat_messages chat_messages_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE CASCADE;


--
-- Name: chat_session_hermes_state chat_session_hermes_state_chat_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."chat_session_hermes_state"
    ADD CONSTRAINT "chat_session_hermes_state_chat_session_id_fkey" FOREIGN KEY ("chat_session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE CASCADE;


--
-- Name: chat_session_hermes_state chat_session_hermes_state_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."chat_session_hermes_state"
    ADD CONSTRAINT "chat_session_hermes_state_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: chat_session_summaries chat_session_summaries_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."chat_session_summaries"
    ADD CONSTRAINT "chat_session_summaries_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE CASCADE;


--
-- Name: chat_session_summaries chat_session_summaries_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."chat_session_summaries"
    ADD CONSTRAINT "chat_session_summaries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: chat_sessions chat_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."chat_sessions"
    ADD CONSTRAINT "chat_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: generated_images generated_images_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."generated_images"
    ADD CONSTRAINT "generated_images_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: graph_relations graph_relations_from_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."graph_relations"
    ADD CONSTRAINT "graph_relations_from_entity_id_fkey" FOREIGN KEY ("from_entity_id") REFERENCES "public"."graph_entities"("id") ON DELETE CASCADE;


--
-- Name: graph_relations graph_relations_to_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."graph_relations"
    ADD CONSTRAINT "graph_relations_to_entity_id_fkey" FOREIGN KEY ("to_entity_id") REFERENCES "public"."graph_entities"("id") ON DELETE CASCADE;


--
-- Name: market_competitor_ads market_competitor_ads_competitor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."market_competitor_ads"
    ADD CONSTRAINT "market_competitor_ads_competitor_id_fkey" FOREIGN KEY ("competitor_id") REFERENCES "public"."market_competitors"("id") ON DELETE CASCADE;


--
-- Name: market_competitors market_competitors_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."market_competitors"
    ADD CONSTRAINT "market_competitors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: market_intelligence_feed market_intelligence_feed_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."market_intelligence_feed"
    ADD CONSTRAINT "market_intelligence_feed_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: market_trends market_trends_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."market_trends"
    ADD CONSTRAINT "market_trends_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: user_chat_integrations user_chat_integrations_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_chat_integrations"
    ADD CONSTRAINT "user_chat_integrations_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: user_chat_integrations user_chat_integrations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_chat_integrations"
    ADD CONSTRAINT "user_chat_integrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: validated_works validated_works_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."validated_works"
    ADD CONSTRAINT "validated_works_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: validated_works validated_works_deprecated_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."validated_works"
    ADD CONSTRAINT "validated_works_deprecated_by_user_id_fkey" FOREIGN KEY ("deprecated_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: validated_works validated_works_validated_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."validated_works"
    ADD CONSTRAINT "validated_works_validated_by_user_id_fkey" FOREIGN KEY ("validated_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: job_items; Type: ROW SECURITY; Schema: image_gen; Owner: postgres
--

ALTER TABLE "image_gen"."job_items" ENABLE ROW LEVEL SECURITY;

--
-- Name: job_items job_items_select_own; Type: POLICY; Schema: image_gen; Owner: postgres
--

CREATE POLICY "job_items_select_own" ON "image_gen"."job_items" FOR SELECT TO "authenticated" USING (("job_id" IN ( SELECT "jobs"."id"
   FROM "image_gen"."jobs"
  WHERE ("jobs"."requested_by" = "auth"."uid"()))));


--
-- Name: job_metrics; Type: ROW SECURITY; Schema: image_gen; Owner: postgres
--

ALTER TABLE "image_gen"."job_metrics" ENABLE ROW LEVEL SECURITY;

--
-- Name: job_metrics job_metrics_select_own; Type: POLICY; Schema: image_gen; Owner: postgres
--

CREATE POLICY "job_metrics_select_own" ON "image_gen"."job_metrics" FOR SELECT TO "authenticated" USING (("job_id" IN ( SELECT "jobs"."id"
   FROM "image_gen"."jobs"
  WHERE ("jobs"."requested_by" = "auth"."uid"()))));


--
-- Name: jobs; Type: ROW SECURITY; Schema: image_gen; Owner: postgres
--

ALTER TABLE "image_gen"."jobs" ENABLE ROW LEVEL SECURITY;

--
-- Name: jobs jobs_select_own; Type: POLICY; Schema: image_gen; Owner: postgres
--

CREATE POLICY "jobs_select_own" ON "image_gen"."jobs" FOR SELECT TO "authenticated" USING (("requested_by" = "auth"."uid"()));


--
-- Name: outputs; Type: ROW SECURITY; Schema: image_gen; Owner: postgres
--

ALTER TABLE "image_gen"."outputs" ENABLE ROW LEVEL SECURITY;

--
-- Name: outputs outputs_select_own; Type: POLICY; Schema: image_gen; Owner: postgres
--

CREATE POLICY "outputs_select_own" ON "image_gen"."outputs" FOR SELECT TO "authenticated" USING (("requested_by" = "auth"."uid"()));


--
-- Name: user_chat_integrations Admins can delete chat integrations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can delete chat integrations" ON "public"."user_chat_integrations" FOR DELETE USING ("public"."is_admin"());


--
-- Name: user_chat_integrations Admins can insert chat integrations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can insert chat integrations" ON "public"."user_chat_integrations" FOR INSERT WITH CHECK ("public"."is_admin"());


--
-- Name: user_chat_integrations Admins can update chat integrations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can update chat integrations" ON "public"."user_chat_integrations" FOR UPDATE USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());


--
-- Name: profiles Admins can view all profiles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can view all profiles" ON "public"."profiles" FOR SELECT USING ("public"."is_admin"());


--
-- Name: validated_works Authenticated users can propose or validate own work; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated users can propose or validate own work" ON "public"."validated_works" FOR INSERT TO "authenticated" WITH CHECK ((("created_by_user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("status" = ANY (ARRAY['draft'::"text", 'validated'::"text"]))));


--
-- Name: graph_entities Authenticated users can read graph_entities; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated users can read graph_entities" ON "public"."graph_entities" FOR SELECT TO "authenticated" USING (true);


--
-- Name: graph_relations Authenticated users can read graph_relations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated users can read graph_relations" ON "public"."graph_relations" FOR SELECT TO "authenticated" USING (true);


--
-- Name: rag_ens Authenticated users can search rag_ens; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated users can search rag_ens" ON "public"."rag_ens" FOR SELECT TO "authenticated" USING (true);


--
-- Name: rag_marketing Authenticated users can search rag_marketing; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated users can search rag_marketing" ON "public"."rag_marketing" FOR SELECT TO "authenticated" USING (true);


--
-- Name: validated_works Managers can delete validated works; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Managers can delete validated works" ON "public"."validated_works" FOR DELETE TO "authenticated" USING (("public"."current_app_profile_role"() = ANY (ARRAY['admin'::"text", 'manager'::"text"])));


--
-- Name: validated_works Managers can update validated works; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Managers can update validated works" ON "public"."validated_works" FOR UPDATE TO "authenticated" USING (("public"."current_app_profile_role"() = ANY (ARRAY['admin'::"text", 'manager'::"text"]))) WITH CHECK (("public"."current_app_profile_role"() = ANY (ARRAY['admin'::"text", 'manager'::"text"])));


--
-- Name: rag_email_html Service Role Only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service Role Only" ON "public"."rag_email_html" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: rag_ens Service Role Only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service Role Only" ON "public"."rag_ens" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: rag_marketing Service Role Only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service Role Only" ON "public"."rag_marketing" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: chat_session_summaries Service role full access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role full access" ON "public"."chat_session_summaries" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: ingestion_logs Service role full access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role full access" ON "public"."ingestion_logs" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: chat_confidence_logs Service role full access confidence logs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role full access confidence logs" ON "public"."chat_confidence_logs" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: graph_entities Service role full access graph_entities; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role full access graph_entities" ON "public"."graph_entities" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: graph_relations Service role full access graph_relations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role full access graph_relations" ON "public"."graph_relations" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: rag_ens Service role full access rag_ens; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role full access rag_ens" ON "public"."rag_ens" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: rag_marketing Service role full access rag_marketing; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role full access rag_marketing" ON "public"."rag_marketing" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: chat_session_summaries Service role full access to summaries; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role full access to summaries" ON "public"."chat_session_summaries" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: chat_sessions Users can delete own sessions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete own sessions" ON "public"."chat_sessions" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));


--
-- Name: chat_session_hermes_state Users can delete their own Hermes chat state; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete their own Hermes chat state" ON "public"."chat_session_hermes_state" FOR DELETE USING (("auth"."uid"() = "user_id"));


--
-- Name: chat_sessions Users can delete their own sessions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete their own sessions" ON "public"."chat_sessions" FOR DELETE USING (("auth"."uid"() = "user_id"));


--
-- Name: chat_messages Users can insert messages to own sessions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert messages to own sessions" ON "public"."chat_messages" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."chat_sessions" "s"
  WHERE (("s"."id" = "chat_messages"."session_id") AND ("s"."user_id" = "auth"."uid"())))));


--
-- Name: chat_messages Users can insert messages to their sessions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert messages to their sessions" ON "public"."chat_messages" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."chat_sessions"
  WHERE (("chat_sessions"."id" = "chat_messages"."session_id") AND ("chat_sessions"."user_id" = "auth"."uid"())))));


--
-- Name: chat_confidence_logs Users can insert own confidence logs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert own confidence logs" ON "public"."chat_confidence_logs" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."chat_sessions" "s"
  WHERE (("s"."id" = "chat_confidence_logs"."session_id") AND ("s"."user_id" = "auth"."uid"())))));


--
-- Name: profiles Users can insert own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));


--
-- Name: chat_sessions Users can insert own sessions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert own sessions" ON "public"."chat_sessions" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: chat_session_hermes_state Users can insert their own Hermes chat state; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert their own Hermes chat state" ON "public"."chat_session_hermes_state" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: chat_sessions Users can insert their own sessions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert their own sessions" ON "public"."chat_sessions" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: market_competitor_ads Users can manage ads of own competitors; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can manage ads of own competitors" ON "public"."market_competitor_ads" USING ((EXISTS ( SELECT 1
   FROM "public"."market_competitors"
  WHERE (("market_competitors"."id" = "market_competitor_ads"."competitor_id") AND ("market_competitors"."user_id" = "auth"."uid"())))));


--
-- Name: market_competitors Users can manage own competitors; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can manage own competitors" ON "public"."market_competitors" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: market_intelligence_feed Users can manage own feed; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can manage own feed" ON "public"."market_intelligence_feed" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: market_trends Users can manage own trends; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can manage own trends" ON "public"."market_trends" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));


--
-- Name: chat_sessions Users can update own sessions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own sessions" ON "public"."chat_sessions" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id"));


--
-- Name: chat_session_hermes_state Users can update their own Hermes chat state; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update their own Hermes chat state" ON "public"."chat_session_hermes_state" FOR UPDATE USING (("auth"."uid"() = "user_id"));


--
-- Name: chat_sessions Users can update their own sessions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update their own sessions" ON "public"."chat_sessions" FOR UPDATE USING (("auth"."uid"() = "user_id"));


--
-- Name: market_competitor_ads Users can view ads of own competitors; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view ads of own competitors" ON "public"."market_competitor_ads" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."market_competitors"
  WHERE (("market_competitors"."id" = "market_competitor_ads"."competitor_id") AND ("market_competitors"."user_id" = "auth"."uid"())))));


--
-- Name: chat_messages Users can view messages of own sessions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view messages of own sessions" ON "public"."chat_messages" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."chat_sessions" "s"
  WHERE (("s"."id" = "chat_messages"."session_id") AND ("s"."user_id" = "auth"."uid"())))));


--
-- Name: chat_messages Users can view messages of their sessions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view messages of their sessions" ON "public"."chat_messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."chat_sessions"
  WHERE (("chat_sessions"."id" = "chat_messages"."session_id") AND ("chat_sessions"."user_id" = "auth"."uid"())))));


--
-- Name: user_chat_integrations Users can view own chat integration; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own chat integration" ON "public"."user_chat_integrations" FOR SELECT USING ((("auth"."uid"() = "user_id") OR "public"."is_admin"()));


--
-- Name: chat_confidence_logs Users can view own confidence logs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own confidence logs" ON "public"."chat_confidence_logs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."chat_sessions" "s"
  WHERE (("s"."id" = "chat_confidence_logs"."session_id") AND ("s"."user_id" = "auth"."uid"())))));


--
-- Name: profiles Users can view own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));


--
-- Name: chat_sessions Users can view own sessions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own sessions" ON "public"."chat_sessions" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));


--
-- Name: chat_session_summaries Users can view own summaries; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own summaries" ON "public"."chat_session_summaries" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));


--
-- Name: chat_session_hermes_state Users can view their own Hermes chat state; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own Hermes chat state" ON "public"."chat_session_hermes_state" FOR SELECT USING (("auth"."uid"() = "user_id"));


--
-- Name: chat_sessions Users can view their own sessions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own sessions" ON "public"."chat_sessions" FOR SELECT USING (("auth"."uid"() = "user_id"));


--
-- Name: generated_images Users delete own images; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users delete own images" ON "public"."generated_images" FOR DELETE USING ((("auth"."uid"() = "user_id") OR "public"."is_admin"()));


--
-- Name: generated_images Users insert own images; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users insert own images" ON "public"."generated_images" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: generated_images Users view own images; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users view own images" ON "public"."generated_images" FOR SELECT USING ((("auth"."uid"() = "user_id") OR "public"."is_admin"()));


--
-- Name: validated_works Validated works are readable by authenticated users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Validated works are readable by authenticated users" ON "public"."validated_works" FOR SELECT TO "authenticated" USING ((("status" = 'validated'::"text") OR ("public"."current_app_profile_role"() = ANY (ARRAY['admin'::"text", 'manager'::"text"])) OR ("created_by_user_id" = ( SELECT "auth"."uid"() AS "uid"))));


--
-- Name: agent_playbooks; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."agent_playbooks" ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_playbooks agent_playbooks_select_tenant_scope; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "agent_playbooks_select_tenant_scope" ON "public"."agent_playbooks" FOR SELECT TO "authenticated" USING ((("tenant_id" = (("auth"."jwt"() ->> 'tenant_id'::"text"))::"uuid") AND ("system_scope" = 'smart_mail'::"text") AND ("status" = 'active'::"text")));


--
-- Name: agent_playbooks agent_playbooks_service_role_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "agent_playbooks_service_role_all" ON "public"."agent_playbooks" TO "service_role" USING (("system_scope" = 'smart_mail'::"text")) WITH CHECK (("system_scope" = 'smart_mail'::"text"));


--
-- Name: chat_confidence_logs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."chat_confidence_logs" ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_messages; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."chat_messages" ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_session_hermes_state; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."chat_session_hermes_state" ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_session_summaries; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."chat_session_summaries" ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_sessions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."chat_sessions" ENABLE ROW LEVEL SECURITY;

--
-- Name: generated_images; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."generated_images" ENABLE ROW LEVEL SECURITY;

--
-- Name: graph_entities; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."graph_entities" ENABLE ROW LEVEL SECURITY;

--
-- Name: graph_relations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."graph_relations" ENABLE ROW LEVEL SECURITY;

--
-- Name: ingestion_logs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ingestion_logs" ENABLE ROW LEVEL SECURITY;

--
-- Name: market_competitor_ads; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."market_competitor_ads" ENABLE ROW LEVEL SECURITY;

--
-- Name: market_competitors; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."market_competitors" ENABLE ROW LEVEL SECURITY;

--
-- Name: market_intelligence_feed; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."market_intelligence_feed" ENABLE ROW LEVEL SECURITY;

--
-- Name: market_trends; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."market_trends" ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

--
-- Name: rag_email_html; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."rag_email_html" ENABLE ROW LEVEL SECURITY;

--
-- Name: rag_ens; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."rag_ens" ENABLE ROW LEVEL SECURITY;

--
-- Name: rag_marketing; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."rag_marketing" ENABLE ROW LEVEL SECURITY;

--
-- Name: user_chat_integrations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."user_chat_integrations" ENABLE ROW LEVEL SECURITY;

--
-- Name: validated_works; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."validated_works" ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_requests; Type: ROW SECURITY; Schema: smart_mail; Owner: postgres
--

ALTER TABLE "smart_mail"."campaign_requests" ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_requests campaign_requests_insert_tenant; Type: POLICY; Schema: smart_mail; Owner: postgres
--

CREATE POLICY "campaign_requests_insert_tenant" ON "smart_mail"."campaign_requests" FOR INSERT TO "authenticated" WITH CHECK ((("tenant_id" = (("auth"."jwt"() ->> 'tenant_id'::"text"))::"uuid") AND ("created_by" = "auth"."uid"()) AND ("system_scope" = 'smart_mail'::"text")));


--
-- Name: campaign_requests campaign_requests_select_tenant; Type: POLICY; Schema: smart_mail; Owner: postgres
--

CREATE POLICY "campaign_requests_select_tenant" ON "smart_mail"."campaign_requests" FOR SELECT TO "authenticated" USING ((("tenant_id" = (("auth"."jwt"() ->> 'tenant_id'::"text"))::"uuid") AND ("system_scope" = 'smart_mail'::"text")));


--
-- Name: campaign_requests campaign_requests_update_tenant; Type: POLICY; Schema: smart_mail; Owner: postgres
--

CREATE POLICY "campaign_requests_update_tenant" ON "smart_mail"."campaign_requests" FOR UPDATE TO "authenticated" USING ((("tenant_id" = (("auth"."jwt"() ->> 'tenant_id'::"text"))::"uuid") AND ("system_scope" = 'smart_mail'::"text"))) WITH CHECK ((("tenant_id" = (("auth"."jwt"() ->> 'tenant_id'::"text"))::"uuid") AND ("system_scope" = 'smart_mail'::"text")));


--
-- Name: knowledge_sources; Type: ROW SECURITY; Schema: smart_mail; Owner: postgres
--

ALTER TABLE "smart_mail"."knowledge_sources" ENABLE ROW LEVEL SECURITY;

--
-- Name: knowledge_sources knowledge_sources_select_tenant_scope; Type: POLICY; Schema: smart_mail; Owner: postgres
--

CREATE POLICY "knowledge_sources_select_tenant_scope" ON "smart_mail"."knowledge_sources" FOR SELECT TO "authenticated" USING ((("tenant_id" = (("auth"."jwt"() ->> 'tenant_id'::"text"))::"uuid") AND ("system_scope" = 'smart_mail'::"text") AND ("status" = 'active'::"text")));


--
-- Name: supabase_realtime; Type: PUBLICATION; Schema: -; Owner: postgres
--

-- CREATE PUBLICATION "supabase_realtime" WITH (publish = 'insert, update, delete, truncate');


ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";

--
-- Name: SCHEMA "public"; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";


--
-- Name: SCHEMA "smart_mail"; Type: ACL; Schema: -; Owner: postgres
--

GRANT USAGE ON SCHEMA "smart_mail" TO "authenticated";


--
-- Name: FUNCTION "gtrgm_in"("cstring"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."gtrgm_in"("cstring") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "gtrgm_out"("extensions"."gtrgm"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."gtrgm_out"("extensions"."gtrgm") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "halfvec_in"("cstring", "oid", integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "service_role";


--
-- Name: FUNCTION "halfvec_out"("public"."halfvec"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "service_role";


--
-- Name: FUNCTION "halfvec_recv"("internal", "oid", integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "service_role";


--
-- Name: FUNCTION "halfvec_send"("public"."halfvec"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "service_role";


--
-- Name: FUNCTION "halfvec_typmod_in"("cstring"[]); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "service_role";


--
-- Name: FUNCTION "sparsevec_in"("cstring", "oid", integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "service_role";


--
-- Name: FUNCTION "sparsevec_out"("public"."sparsevec"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "service_role";


--
-- Name: FUNCTION "sparsevec_recv"("internal", "oid", integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "service_role";


--
-- Name: FUNCTION "sparsevec_send"("public"."sparsevec"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "service_role";


--
-- Name: FUNCTION "sparsevec_typmod_in"("cstring"[]); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "service_role";


--
-- Name: FUNCTION "vector_in"("cstring", "oid", integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "service_role";


--
-- Name: FUNCTION "vector_out"("public"."vector"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "service_role";


--
-- Name: FUNCTION "vector_recv"("internal", "oid", integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "service_role";


--
-- Name: FUNCTION "vector_send"("public"."vector"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "service_role";


--
-- Name: FUNCTION "vector_typmod_in"("cstring"[]); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "service_role";


--
-- Name: FUNCTION "array_to_halfvec"(real[], integer, boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "service_role";


--
-- Name: FUNCTION "array_to_sparsevec"(real[], integer, boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "service_role";


--
-- Name: FUNCTION "array_to_vector"(real[], integer, boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "service_role";


--
-- Name: FUNCTION "array_to_halfvec"(double precision[], integer, boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "service_role";


--
-- Name: FUNCTION "array_to_sparsevec"(double precision[], integer, boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "service_role";


--
-- Name: FUNCTION "array_to_vector"(double precision[], integer, boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "service_role";


--
-- Name: FUNCTION "array_to_halfvec"(integer[], integer, boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "service_role";


--
-- Name: FUNCTION "array_to_sparsevec"(integer[], integer, boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "service_role";


--
-- Name: FUNCTION "array_to_vector"(integer[], integer, boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "service_role";


--
-- Name: FUNCTION "array_to_halfvec"(numeric[], integer, boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "service_role";


--
-- Name: FUNCTION "array_to_sparsevec"(numeric[], integer, boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "service_role";


--
-- Name: FUNCTION "array_to_vector"(numeric[], integer, boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "service_role";


--
-- Name: FUNCTION "halfvec_to_float4"("public"."halfvec", integer, boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "service_role";


--
-- Name: FUNCTION "halfvec"("public"."halfvec", integer, boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "service_role";


--
-- Name: FUNCTION "halfvec_to_sparsevec"("public"."halfvec", integer, boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "service_role";


--
-- Name: FUNCTION "halfvec_to_vector"("public"."halfvec", integer, boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "service_role";


--
-- Name: FUNCTION "sparsevec_to_halfvec"("public"."sparsevec", integer, boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "service_role";


--
-- Name: FUNCTION "sparsevec"("public"."sparsevec", integer, boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "service_role";


--
-- Name: FUNCTION "sparsevec_to_vector"("public"."sparsevec", integer, boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "service_role";


--
-- Name: FUNCTION "vector_to_float4"("public"."vector", integer, boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "service_role";


--
-- Name: FUNCTION "vector_to_halfvec"("public"."vector", integer, boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "service_role";


--
-- Name: FUNCTION "vector_to_sparsevec"("public"."vector", integer, boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "service_role";


--
-- Name: FUNCTION "vector"("public"."vector", integer, boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "service_role";


--
-- Name: FUNCTION "armor"("bytea"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."armor"("bytea") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."armor"("bytea") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."armor"("bytea") TO "dashboard_user";


--
-- Name: FUNCTION "armor"("bytea", "text"[], "text"[]); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."armor"("bytea", "text"[], "text"[]) FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."armor"("bytea", "text"[], "text"[]) TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."armor"("bytea", "text"[], "text"[]) TO "dashboard_user";


--
-- Name: FUNCTION "crypt"("text", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."crypt"("text", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."crypt"("text", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."crypt"("text", "text") TO "dashboard_user";


--
-- Name: FUNCTION "dearmor"("text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."dearmor"("text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."dearmor"("text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."dearmor"("text") TO "dashboard_user";


--
-- Name: FUNCTION "decrypt"("bytea", "bytea", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."decrypt"("bytea", "bytea", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."decrypt"("bytea", "bytea", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."decrypt"("bytea", "bytea", "text") TO "dashboard_user";


--
-- Name: FUNCTION "decrypt_iv"("bytea", "bytea", "bytea", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."decrypt_iv"("bytea", "bytea", "bytea", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."decrypt_iv"("bytea", "bytea", "bytea", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."decrypt_iv"("bytea", "bytea", "bytea", "text") TO "dashboard_user";


--
-- Name: FUNCTION "digest"("bytea", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."digest"("bytea", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."digest"("bytea", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."digest"("bytea", "text") TO "dashboard_user";


--
-- Name: FUNCTION "digest"("text", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."digest"("text", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."digest"("text", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."digest"("text", "text") TO "dashboard_user";


--
-- Name: FUNCTION "encrypt"("bytea", "bytea", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."encrypt"("bytea", "bytea", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."encrypt"("bytea", "bytea", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."encrypt"("bytea", "bytea", "text") TO "dashboard_user";


--
-- Name: FUNCTION "encrypt_iv"("bytea", "bytea", "bytea", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."encrypt_iv"("bytea", "bytea", "bytea", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."encrypt_iv"("bytea", "bytea", "bytea", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."encrypt_iv"("bytea", "bytea", "bytea", "text") TO "dashboard_user";


--
-- Name: FUNCTION "gen_random_bytes"(integer); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."gen_random_bytes"(integer) FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."gen_random_bytes"(integer) TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."gen_random_bytes"(integer) TO "dashboard_user";


--
-- Name: FUNCTION "gen_random_uuid"(); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."gen_random_uuid"() FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."gen_random_uuid"() TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."gen_random_uuid"() TO "dashboard_user";


--
-- Name: FUNCTION "gen_salt"("text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."gen_salt"("text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."gen_salt"("text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."gen_salt"("text") TO "dashboard_user";


--
-- Name: FUNCTION "gen_salt"("text", integer); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."gen_salt"("text", integer) FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."gen_salt"("text", integer) TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."gen_salt"("text", integer) TO "dashboard_user";


--
-- Name: FUNCTION "gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "gin_extract_value_trgm"("text", "internal"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."gin_extract_value_trgm"("text", "internal") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "gtrgm_compress"("internal"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."gtrgm_compress"("internal") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "gtrgm_consistent"("internal", "text", smallint, "oid", "internal"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "gtrgm_decompress"("internal"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."gtrgm_decompress"("internal") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "gtrgm_distance"("internal", "text", smallint, "oid", "internal"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "gtrgm_options"("internal"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."gtrgm_options"("internal") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "gtrgm_penalty"("internal", "internal", "internal"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."gtrgm_penalty"("internal", "internal", "internal") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "gtrgm_picksplit"("internal", "internal"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."gtrgm_picksplit"("internal", "internal") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "gtrgm_same"("extensions"."gtrgm", "extensions"."gtrgm", "internal"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."gtrgm_same"("extensions"."gtrgm", "extensions"."gtrgm", "internal") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "gtrgm_union"("internal", "internal"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."gtrgm_union"("internal", "internal") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "hmac"("bytea", "bytea", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."hmac"("bytea", "bytea", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."hmac"("bytea", "bytea", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."hmac"("bytea", "bytea", "text") TO "dashboard_user";


--
-- Name: FUNCTION "hmac"("text", "text", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."hmac"("text", "text", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."hmac"("text", "text", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."hmac"("text", "text", "text") TO "dashboard_user";


--
-- Name: FUNCTION "pg_stat_statements"("showtext" boolean, OUT "userid" "oid", OUT "dbid" "oid", OUT "toplevel" boolean, OUT "queryid" bigint, OUT "query" "text", OUT "plans" bigint, OUT "total_plan_time" double precision, OUT "min_plan_time" double precision, OUT "max_plan_time" double precision, OUT "mean_plan_time" double precision, OUT "stddev_plan_time" double precision, OUT "calls" bigint, OUT "total_exec_time" double precision, OUT "min_exec_time" double precision, OUT "max_exec_time" double precision, OUT "mean_exec_time" double precision, OUT "stddev_exec_time" double precision, OUT "rows" bigint, OUT "shared_blks_hit" bigint, OUT "shared_blks_read" bigint, OUT "shared_blks_dirtied" bigint, OUT "shared_blks_written" bigint, OUT "local_blks_hit" bigint, OUT "local_blks_read" bigint, OUT "local_blks_dirtied" bigint, OUT "local_blks_written" bigint, OUT "temp_blks_read" bigint, OUT "temp_blks_written" bigint, OUT "shared_blk_read_time" double precision, OUT "shared_blk_write_time" double precision, OUT "local_blk_read_time" double precision, OUT "local_blk_write_time" double precision, OUT "temp_blk_read_time" double precision, OUT "temp_blk_write_time" double precision, OUT "wal_records" bigint, OUT "wal_fpi" bigint, OUT "wal_bytes" numeric, OUT "jit_functions" bigint, OUT "jit_generation_time" double precision, OUT "jit_inlining_count" bigint, OUT "jit_inlining_time" double precision, OUT "jit_optimization_count" bigint, OUT "jit_optimization_time" double precision, OUT "jit_emission_count" bigint, OUT "jit_emission_time" double precision, OUT "jit_deform_count" bigint, OUT "jit_deform_time" double precision, OUT "stats_since" timestamp with time zone, OUT "minmax_stats_since" timestamp with time zone); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pg_stat_statements"("showtext" boolean, OUT "userid" "oid", OUT "dbid" "oid", OUT "toplevel" boolean, OUT "queryid" bigint, OUT "query" "text", OUT "plans" bigint, OUT "total_plan_time" double precision, OUT "min_plan_time" double precision, OUT "max_plan_time" double precision, OUT "mean_plan_time" double precision, OUT "stddev_plan_time" double precision, OUT "calls" bigint, OUT "total_exec_time" double precision, OUT "min_exec_time" double precision, OUT "max_exec_time" double precision, OUT "mean_exec_time" double precision, OUT "stddev_exec_time" double precision, OUT "rows" bigint, OUT "shared_blks_hit" bigint, OUT "shared_blks_read" bigint, OUT "shared_blks_dirtied" bigint, OUT "shared_blks_written" bigint, OUT "local_blks_hit" bigint, OUT "local_blks_read" bigint, OUT "local_blks_dirtied" bigint, OUT "local_blks_written" bigint, OUT "temp_blks_read" bigint, OUT "temp_blks_written" bigint, OUT "shared_blk_read_time" double precision, OUT "shared_blk_write_time" double precision, OUT "local_blk_read_time" double precision, OUT "local_blk_write_time" double precision, OUT "temp_blk_read_time" double precision, OUT "temp_blk_write_time" double precision, OUT "wal_records" bigint, OUT "wal_fpi" bigint, OUT "wal_bytes" numeric, OUT "jit_functions" bigint, OUT "jit_generation_time" double precision, OUT "jit_inlining_count" bigint, OUT "jit_inlining_time" double precision, OUT "jit_optimization_count" bigint, OUT "jit_optimization_time" double precision, OUT "jit_emission_count" bigint, OUT "jit_emission_time" double precision, OUT "jit_deform_count" bigint, OUT "jit_deform_time" double precision, OUT "stats_since" timestamp with time zone, OUT "minmax_stats_since" timestamp with time zone) FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pg_stat_statements"("showtext" boolean, OUT "userid" "oid", OUT "dbid" "oid", OUT "toplevel" boolean, OUT "queryid" bigint, OUT "query" "text", OUT "plans" bigint, OUT "total_plan_time" double precision, OUT "min_plan_time" double precision, OUT "max_plan_time" double precision, OUT "mean_plan_time" double precision, OUT "stddev_plan_time" double precision, OUT "calls" bigint, OUT "total_exec_time" double precision, OUT "min_exec_time" double precision, OUT "max_exec_time" double precision, OUT "mean_exec_time" double precision, OUT "stddev_exec_time" double precision, OUT "rows" bigint, OUT "shared_blks_hit" bigint, OUT "shared_blks_read" bigint, OUT "shared_blks_dirtied" bigint, OUT "shared_blks_written" bigint, OUT "local_blks_hit" bigint, OUT "local_blks_read" bigint, OUT "local_blks_dirtied" bigint, OUT "local_blks_written" bigint, OUT "temp_blks_read" bigint, OUT "temp_blks_written" bigint, OUT "shared_blk_read_time" double precision, OUT "shared_blk_write_time" double precision, OUT "local_blk_read_time" double precision, OUT "local_blk_write_time" double precision, OUT "temp_blk_read_time" double precision, OUT "temp_blk_write_time" double precision, OUT "wal_records" bigint, OUT "wal_fpi" bigint, OUT "wal_bytes" numeric, OUT "jit_functions" bigint, OUT "jit_generation_time" double precision, OUT "jit_inlining_count" bigint, OUT "jit_inlining_time" double precision, OUT "jit_optimization_count" bigint, OUT "jit_optimization_time" double precision, OUT "jit_emission_count" bigint, OUT "jit_emission_time" double precision, OUT "jit_deform_count" bigint, OUT "jit_deform_time" double precision, OUT "stats_since" timestamp with time zone, OUT "minmax_stats_since" timestamp with time zone) TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pg_stat_statements"("showtext" boolean, OUT "userid" "oid", OUT "dbid" "oid", OUT "toplevel" boolean, OUT "queryid" bigint, OUT "query" "text", OUT "plans" bigint, OUT "total_plan_time" double precision, OUT "min_plan_time" double precision, OUT "max_plan_time" double precision, OUT "mean_plan_time" double precision, OUT "stddev_plan_time" double precision, OUT "calls" bigint, OUT "total_exec_time" double precision, OUT "min_exec_time" double precision, OUT "max_exec_time" double precision, OUT "mean_exec_time" double precision, OUT "stddev_exec_time" double precision, OUT "rows" bigint, OUT "shared_blks_hit" bigint, OUT "shared_blks_read" bigint, OUT "shared_blks_dirtied" bigint, OUT "shared_blks_written" bigint, OUT "local_blks_hit" bigint, OUT "local_blks_read" bigint, OUT "local_blks_dirtied" bigint, OUT "local_blks_written" bigint, OUT "temp_blks_read" bigint, OUT "temp_blks_written" bigint, OUT "shared_blk_read_time" double precision, OUT "shared_blk_write_time" double precision, OUT "local_blk_read_time" double precision, OUT "local_blk_write_time" double precision, OUT "temp_blk_read_time" double precision, OUT "temp_blk_write_time" double precision, OUT "wal_records" bigint, OUT "wal_fpi" bigint, OUT "wal_bytes" numeric, OUT "jit_functions" bigint, OUT "jit_generation_time" double precision, OUT "jit_inlining_count" bigint, OUT "jit_inlining_time" double precision, OUT "jit_optimization_count" bigint, OUT "jit_optimization_time" double precision, OUT "jit_emission_count" bigint, OUT "jit_emission_time" double precision, OUT "jit_deform_count" bigint, OUT "jit_deform_time" double precision, OUT "stats_since" timestamp with time zone, OUT "minmax_stats_since" timestamp with time zone) TO "dashboard_user";


--
-- Name: FUNCTION "pg_stat_statements_info"(OUT "dealloc" bigint, OUT "stats_reset" timestamp with time zone); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pg_stat_statements_info"(OUT "dealloc" bigint, OUT "stats_reset" timestamp with time zone) FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pg_stat_statements_info"(OUT "dealloc" bigint, OUT "stats_reset" timestamp with time zone) TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pg_stat_statements_info"(OUT "dealloc" bigint, OUT "stats_reset" timestamp with time zone) TO "dashboard_user";


--
-- Name: FUNCTION "pg_stat_statements_reset"("userid" "oid", "dbid" "oid", "queryid" bigint, "minmax_only" boolean); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pg_stat_statements_reset"("userid" "oid", "dbid" "oid", "queryid" bigint, "minmax_only" boolean) FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pg_stat_statements_reset"("userid" "oid", "dbid" "oid", "queryid" bigint, "minmax_only" boolean) TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pg_stat_statements_reset"("userid" "oid", "dbid" "oid", "queryid" bigint, "minmax_only" boolean) TO "dashboard_user";


--
-- Name: FUNCTION "pgp_armor_headers"("text", OUT "key" "text", OUT "value" "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_armor_headers"("text", OUT "key" "text", OUT "value" "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_armor_headers"("text", OUT "key" "text", OUT "value" "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_armor_headers"("text", OUT "key" "text", OUT "value" "text") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_key_id"("bytea"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_key_id"("bytea") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_key_id"("bytea") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_key_id"("bytea") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_pub_decrypt"("bytea", "bytea"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_pub_decrypt"("bytea", "bytea") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt"("bytea", "bytea") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt"("bytea", "bytea") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_pub_decrypt"("bytea", "bytea", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_pub_decrypt"("bytea", "bytea", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt"("bytea", "bytea", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt"("bytea", "bytea", "text") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_pub_decrypt"("bytea", "bytea", "text", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_pub_decrypt"("bytea", "bytea", "text", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt"("bytea", "bytea", "text", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt"("bytea", "bytea", "text", "text") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_pub_decrypt_bytea"("bytea", "bytea"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_pub_decrypt_bytea"("bytea", "bytea") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt_bytea"("bytea", "bytea") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt_bytea"("bytea", "bytea") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_pub_decrypt_bytea"("bytea", "bytea", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_pub_decrypt_bytea"("bytea", "bytea", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt_bytea"("bytea", "bytea", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt_bytea"("bytea", "bytea", "text") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_pub_decrypt_bytea"("bytea", "bytea", "text", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_pub_decrypt_bytea"("bytea", "bytea", "text", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt_bytea"("bytea", "bytea", "text", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt_bytea"("bytea", "bytea", "text", "text") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_pub_encrypt"("text", "bytea"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_pub_encrypt"("text", "bytea") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_encrypt"("text", "bytea") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_encrypt"("text", "bytea") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_pub_encrypt"("text", "bytea", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_pub_encrypt"("text", "bytea", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_encrypt"("text", "bytea", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_encrypt"("text", "bytea", "text") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_pub_encrypt_bytea"("bytea", "bytea"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_pub_encrypt_bytea"("bytea", "bytea") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_encrypt_bytea"("bytea", "bytea") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_encrypt_bytea"("bytea", "bytea") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_pub_encrypt_bytea"("bytea", "bytea", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_pub_encrypt_bytea"("bytea", "bytea", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_encrypt_bytea"("bytea", "bytea", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_encrypt_bytea"("bytea", "bytea", "text") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_sym_decrypt"("bytea", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_sym_decrypt"("bytea", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_decrypt"("bytea", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_decrypt"("bytea", "text") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_sym_decrypt"("bytea", "text", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_sym_decrypt"("bytea", "text", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_decrypt"("bytea", "text", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_decrypt"("bytea", "text", "text") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_sym_decrypt_bytea"("bytea", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_sym_decrypt_bytea"("bytea", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_decrypt_bytea"("bytea", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_decrypt_bytea"("bytea", "text") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_sym_decrypt_bytea"("bytea", "text", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_sym_decrypt_bytea"("bytea", "text", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_decrypt_bytea"("bytea", "text", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_decrypt_bytea"("bytea", "text", "text") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_sym_encrypt"("text", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_sym_encrypt"("text", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_encrypt"("text", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_encrypt"("text", "text") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_sym_encrypt"("text", "text", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_sym_encrypt"("text", "text", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_encrypt"("text", "text", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_encrypt"("text", "text", "text") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_sym_encrypt_bytea"("bytea", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_sym_encrypt_bytea"("bytea", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_encrypt_bytea"("bytea", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_encrypt_bytea"("bytea", "text") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_sym_encrypt_bytea"("bytea", "text", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_sym_encrypt_bytea"("bytea", "text", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_encrypt_bytea"("bytea", "text", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_encrypt_bytea"("bytea", "text", "text") TO "dashboard_user";


--
-- Name: FUNCTION "set_limit"(real); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."set_limit"(real) TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "show_limit"(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."show_limit"() TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "show_trgm"("text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."show_trgm"("text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "similarity"("text", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."similarity"("text", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "similarity_dist"("text", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."similarity_dist"("text", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "similarity_op"("text", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."similarity_op"("text", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "strict_word_similarity"("text", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."strict_word_similarity"("text", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "strict_word_similarity_commutator_op"("text", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."strict_word_similarity_commutator_op"("text", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "strict_word_similarity_dist_commutator_op"("text", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."strict_word_similarity_dist_commutator_op"("text", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "strict_word_similarity_dist_op"("text", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."strict_word_similarity_dist_op"("text", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "strict_word_similarity_op"("text", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."strict_word_similarity_op"("text", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "uuid_generate_v1"(); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."uuid_generate_v1"() FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."uuid_generate_v1"() TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."uuid_generate_v1"() TO "dashboard_user";


--
-- Name: FUNCTION "uuid_generate_v1mc"(); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."uuid_generate_v1mc"() FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."uuid_generate_v1mc"() TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."uuid_generate_v1mc"() TO "dashboard_user";


--
-- Name: FUNCTION "uuid_generate_v3"("namespace" "uuid", "name" "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."uuid_generate_v3"("namespace" "uuid", "name" "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."uuid_generate_v3"("namespace" "uuid", "name" "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."uuid_generate_v3"("namespace" "uuid", "name" "text") TO "dashboard_user";


--
-- Name: FUNCTION "uuid_generate_v4"(); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."uuid_generate_v4"() FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."uuid_generate_v4"() TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."uuid_generate_v4"() TO "dashboard_user";


--
-- Name: FUNCTION "uuid_generate_v5"("namespace" "uuid", "name" "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."uuid_generate_v5"("namespace" "uuid", "name" "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."uuid_generate_v5"("namespace" "uuid", "name" "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."uuid_generate_v5"("namespace" "uuid", "name" "text") TO "dashboard_user";


--
-- Name: FUNCTION "uuid_nil"(); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."uuid_nil"() FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."uuid_nil"() TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."uuid_nil"() TO "dashboard_user";


--
-- Name: FUNCTION "uuid_ns_dns"(); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."uuid_ns_dns"() FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."uuid_ns_dns"() TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."uuid_ns_dns"() TO "dashboard_user";


--
-- Name: FUNCTION "uuid_ns_oid"(); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."uuid_ns_oid"() FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."uuid_ns_oid"() TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."uuid_ns_oid"() TO "dashboard_user";


--
-- Name: FUNCTION "uuid_ns_url"(); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."uuid_ns_url"() FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."uuid_ns_url"() TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."uuid_ns_url"() TO "dashboard_user";


--
-- Name: FUNCTION "uuid_ns_x500"(); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."uuid_ns_x500"() FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."uuid_ns_x500"() TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."uuid_ns_x500"() TO "dashboard_user";


--
-- Name: FUNCTION "word_similarity"("text", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."word_similarity"("text", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "word_similarity_commutator_op"("text", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."word_similarity_commutator_op"("text", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "word_similarity_dist_commutator_op"("text", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."word_similarity_dist_commutator_op"("text", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "word_similarity_dist_op"("text", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."word_similarity_dist_op"("text", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "word_similarity_op"("text", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."word_similarity_op"("text", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "admin_update_profile"("target_user_id" "uuid", "new_full_name" "text", "new_avatar_url" "text"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."admin_update_profile"("target_user_id" "uuid", "new_full_name" "text", "new_avatar_url" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_update_profile"("target_user_id" "uuid", "new_full_name" "text", "new_avatar_url" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_update_profile"("target_user_id" "uuid", "new_full_name" "text", "new_avatar_url" "text") TO "service_role";


--
-- Name: TABLE "profiles"; Type: ACL; Schema: public; Owner: postgres
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";


--
-- Name: FUNCTION "admin_update_profile"("target_user_id" "uuid", "new_full_name" "text", "new_avatar_url" "text", "new_role" "text"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."admin_update_profile"("target_user_id" "uuid", "new_full_name" "text", "new_avatar_url" "text", "new_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_update_profile"("target_user_id" "uuid", "new_full_name" "text", "new_avatar_url" "text", "new_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_update_profile"("target_user_id" "uuid", "new_full_name" "text", "new_avatar_url" "text", "new_role" "text") TO "service_role";


--
-- Name: TABLE "user_chat_integrations"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."user_chat_integrations" TO "anon";
GRANT ALL ON TABLE "public"."user_chat_integrations" TO "authenticated";
GRANT ALL ON TABLE "public"."user_chat_integrations" TO "service_role";


--
-- Name: FUNCTION "admin_upsert_user_chat_integration"("target_user_id" "uuid", "new_hermes_enabled" boolean, "new_hermes_base_url" "text"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."admin_upsert_user_chat_integration"("target_user_id" "uuid", "new_hermes_enabled" boolean, "new_hermes_base_url" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_upsert_user_chat_integration"("target_user_id" "uuid", "new_hermes_enabled" boolean, "new_hermes_base_url" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_upsert_user_chat_integration"("target_user_id" "uuid", "new_hermes_enabled" boolean, "new_hermes_base_url" "text") TO "service_role";


--
-- Name: FUNCTION "binary_quantize"("public"."halfvec"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "service_role";


--
-- Name: FUNCTION "binary_quantize"("public"."vector"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "service_role";


--
-- Name: FUNCTION "cosine_distance"("public"."halfvec", "public"."halfvec"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "service_role";


--
-- Name: FUNCTION "cosine_distance"("public"."sparsevec", "public"."sparsevec"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";


--
-- Name: FUNCTION "cosine_distance"("public"."vector", "public"."vector"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "service_role";


--
-- Name: FUNCTION "create_user_by_admin"("email" "text", "password" "text", "full_name" "text"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."create_user_by_admin"("email" "text", "password" "text", "full_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_user_by_admin"("email" "text", "password" "text", "full_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_user_by_admin"("email" "text", "password" "text", "full_name" "text") TO "service_role";


--
-- Name: FUNCTION "current_app_profile_role"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."current_app_profile_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_app_profile_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_app_profile_role"() TO "service_role";


--
-- Name: FUNCTION "delete_rag_chunks_by_file_id"("target_table" "text", "file_id" "text"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."delete_rag_chunks_by_file_id"("target_table" "text", "file_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_rag_chunks_by_file_id"("target_table" "text", "file_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_rag_chunks_by_file_id"("target_table" "text", "file_id" "text") TO "service_role";


--
-- Name: FUNCTION "delete_user_by_admin"("target_user_id" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."delete_user_by_admin"("target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_user_by_admin"("target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_user_by_admin"("target_user_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "halfvec_accum"(double precision[], "public"."halfvec"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "service_role";


--
-- Name: FUNCTION "halfvec_add"("public"."halfvec", "public"."halfvec"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "service_role";


--
-- Name: FUNCTION "halfvec_avg"(double precision[]); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "service_role";


--
-- Name: FUNCTION "halfvec_cmp"("public"."halfvec", "public"."halfvec"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "service_role";


--
-- Name: FUNCTION "halfvec_combine"(double precision[], double precision[]); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "service_role";


--
-- Name: FUNCTION "halfvec_concat"("public"."halfvec", "public"."halfvec"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "service_role";


--
-- Name: FUNCTION "halfvec_eq"("public"."halfvec", "public"."halfvec"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "service_role";


--
-- Name: FUNCTION "halfvec_ge"("public"."halfvec", "public"."halfvec"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "service_role";


--
-- Name: FUNCTION "halfvec_gt"("public"."halfvec", "public"."halfvec"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "service_role";


--
-- Name: FUNCTION "halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "service_role";


--
-- Name: FUNCTION "halfvec_le"("public"."halfvec", "public"."halfvec"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "service_role";


--
-- Name: FUNCTION "halfvec_lt"("public"."halfvec", "public"."halfvec"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "service_role";


--
-- Name: FUNCTION "halfvec_mul"("public"."halfvec", "public"."halfvec"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "service_role";


--
-- Name: FUNCTION "halfvec_ne"("public"."halfvec", "public"."halfvec"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "service_role";


--
-- Name: FUNCTION "halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "service_role";


--
-- Name: FUNCTION "halfvec_spherical_distance"("public"."halfvec", "public"."halfvec"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "service_role";


--
-- Name: FUNCTION "halfvec_sub"("public"."halfvec", "public"."halfvec"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "service_role";


--
-- Name: FUNCTION "hamming_distance"(bit, bit); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "postgres";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "anon";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "authenticated";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "service_role";


--
-- Name: FUNCTION "handle_new_user"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";


--
-- Name: FUNCTION "hnsw_bit_support"("internal"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "service_role";


--
-- Name: FUNCTION "hnsw_halfvec_support"("internal"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "service_role";


--
-- Name: FUNCTION "hnsw_sparsevec_support"("internal"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "service_role";


--
-- Name: FUNCTION "hnswhandler"("internal"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "service_role";


--
-- Name: FUNCTION "inner_product"("public"."halfvec", "public"."halfvec"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "service_role";


--
-- Name: FUNCTION "inner_product"("public"."sparsevec", "public"."sparsevec"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "service_role";


--
-- Name: FUNCTION "inner_product"("public"."vector", "public"."vector"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "service_role";


--
-- Name: FUNCTION "is_admin"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";


--
-- Name: FUNCTION "ivfflat_bit_support"("internal"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "service_role";


--
-- Name: FUNCTION "ivfflat_halfvec_support"("internal"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "service_role";


--
-- Name: FUNCTION "ivfflathandler"("internal"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "service_role";


--
-- Name: FUNCTION "jaccard_distance"(bit, bit); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "postgres";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "anon";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "authenticated";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "service_role";


--
-- Name: FUNCTION "kw_match_rag_ens"("query_text" "text", "match_threshold" double precision, "match_count" integer, "filter" "jsonb"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."kw_match_rag_ens"("query_text" "text", "match_threshold" double precision, "match_count" integer, "filter" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."kw_match_rag_ens"("query_text" "text", "match_threshold" double precision, "match_count" integer, "filter" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."kw_match_rag_ens"("query_text" "text", "match_threshold" double precision, "match_count" integer, "filter" "jsonb") TO "service_role";


--
-- Name: FUNCTION "kw_match_rag_marketing"("query_text" "text", "match_threshold" double precision, "match_count" integer, "filter" "jsonb"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."kw_match_rag_marketing"("query_text" "text", "match_threshold" double precision, "match_count" integer, "filter" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."kw_match_rag_marketing"("query_text" "text", "match_threshold" double precision, "match_count" integer, "filter" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."kw_match_rag_marketing"("query_text" "text", "match_threshold" double precision, "match_count" integer, "filter" "jsonb") TO "service_role";


--
-- Name: FUNCTION "l1_distance"("public"."halfvec", "public"."halfvec"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "service_role";


--
-- Name: FUNCTION "l1_distance"("public"."sparsevec", "public"."sparsevec"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";


--
-- Name: FUNCTION "l1_distance"("public"."vector", "public"."vector"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "service_role";


--
-- Name: FUNCTION "l2_distance"("public"."halfvec", "public"."halfvec"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "service_role";


--
-- Name: FUNCTION "l2_distance"("public"."sparsevec", "public"."sparsevec"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";


--
-- Name: FUNCTION "l2_distance"("public"."vector", "public"."vector"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "service_role";


--
-- Name: FUNCTION "l2_norm"("public"."halfvec"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "service_role";


--
-- Name: FUNCTION "l2_norm"("public"."sparsevec"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "service_role";


--
-- Name: FUNCTION "l2_normalize"("public"."halfvec"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "service_role";


--
-- Name: FUNCTION "l2_normalize"("public"."sparsevec"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "service_role";


--
-- Name: FUNCTION "l2_normalize"("public"."vector"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "service_role";


--
-- Name: FUNCTION "match_rag_email_html"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter" "jsonb"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."match_rag_email_html"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."match_rag_email_html"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_rag_email_html"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter" "jsonb") TO "service_role";


--
-- Name: FUNCTION "match_rag_ens"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter" "jsonb"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."match_rag_ens"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."match_rag_ens"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_rag_ens"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter" "jsonb") TO "service_role";


--
-- Name: FUNCTION "match_rag_marketing"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter" "jsonb"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."match_rag_marketing"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."match_rag_marketing"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_rag_marketing"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter" "jsonb") TO "service_role";


--
-- Name: FUNCTION "sparsevec_cmp"("public"."sparsevec", "public"."sparsevec"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "service_role";


--
-- Name: FUNCTION "sparsevec_eq"("public"."sparsevec", "public"."sparsevec"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "service_role";


--
-- Name: FUNCTION "sparsevec_ge"("public"."sparsevec", "public"."sparsevec"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "service_role";


--
-- Name: FUNCTION "sparsevec_gt"("public"."sparsevec", "public"."sparsevec"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "service_role";


--
-- Name: FUNCTION "sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";


--
-- Name: FUNCTION "sparsevec_le"("public"."sparsevec", "public"."sparsevec"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "service_role";


--
-- Name: FUNCTION "sparsevec_lt"("public"."sparsevec", "public"."sparsevec"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "service_role";


--
-- Name: FUNCTION "sparsevec_ne"("public"."sparsevec", "public"."sparsevec"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "service_role";


--
-- Name: FUNCTION "sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "service_role";


--
-- Name: FUNCTION "subvector"("public"."halfvec", integer, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "service_role";


--
-- Name: FUNCTION "subvector"("public"."vector", integer, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "service_role";


--
-- Name: FUNCTION "touch_chat_session_hermes_state_updated_at"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."touch_chat_session_hermes_state_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_chat_session_hermes_state_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_chat_session_hermes_state_updated_at"() TO "service_role";


--
-- Name: FUNCTION "touch_validated_works_updated_at"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."touch_validated_works_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_validated_works_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_validated_works_updated_at"() TO "service_role";


--
-- Name: FUNCTION "update_chat_session_message_count"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."update_chat_session_message_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_chat_session_message_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_chat_session_message_count"() TO "service_role";


--
-- Name: FUNCTION "update_updated_at_column"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";


--
-- Name: FUNCTION "vector_accum"(double precision[], "public"."vector"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "service_role";


--
-- Name: FUNCTION "vector_add"("public"."vector", "public"."vector"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "service_role";


--
-- Name: FUNCTION "vector_avg"(double precision[]); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "service_role";


--
-- Name: FUNCTION "vector_cmp"("public"."vector", "public"."vector"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "service_role";


--
-- Name: FUNCTION "vector_combine"(double precision[], double precision[]); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "service_role";


--
-- Name: FUNCTION "vector_concat"("public"."vector", "public"."vector"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "service_role";


--
-- Name: FUNCTION "vector_dims"("public"."halfvec"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "service_role";


--
-- Name: FUNCTION "vector_dims"("public"."vector"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "service_role";


--
-- Name: FUNCTION "vector_eq"("public"."vector", "public"."vector"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "service_role";


--
-- Name: FUNCTION "vector_ge"("public"."vector", "public"."vector"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "service_role";


--
-- Name: FUNCTION "vector_gt"("public"."vector", "public"."vector"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "service_role";


--
-- Name: FUNCTION "vector_l2_squared_distance"("public"."vector", "public"."vector"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "service_role";


--
-- Name: FUNCTION "vector_le"("public"."vector", "public"."vector"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "service_role";


--
-- Name: FUNCTION "vector_lt"("public"."vector", "public"."vector"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "service_role";


--
-- Name: FUNCTION "vector_mul"("public"."vector", "public"."vector"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "service_role";


--
-- Name: FUNCTION "vector_ne"("public"."vector", "public"."vector"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "service_role";


--
-- Name: FUNCTION "vector_negative_inner_product"("public"."vector", "public"."vector"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "service_role";


--
-- Name: FUNCTION "vector_norm"("public"."vector"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "service_role";


--
-- Name: FUNCTION "vector_spherical_distance"("public"."vector", "public"."vector"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "service_role";


--
-- Name: FUNCTION "vector_sub"("public"."vector", "public"."vector"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "service_role";


--
-- Name: FUNCTION "_crypto_aead_det_decrypt"("message" "bytea", "additional" "bytea", "key_id" bigint, "context" "bytea", "nonce" "bytea"); Type: ACL; Schema: vault; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "vault"."_crypto_aead_det_decrypt"("message" "bytea", "additional" "bytea", "key_id" bigint, "context" "bytea", "nonce" "bytea") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "vault"."_crypto_aead_det_decrypt"("message" "bytea", "additional" "bytea", "key_id" bigint, "context" "bytea", "nonce" "bytea") TO "service_role";


--
-- Name: FUNCTION "create_secret"("new_secret" "text", "new_name" "text", "new_description" "text", "new_key_id" "uuid"); Type: ACL; Schema: vault; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "vault"."create_secret"("new_secret" "text", "new_name" "text", "new_description" "text", "new_key_id" "uuid") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "vault"."create_secret"("new_secret" "text", "new_name" "text", "new_description" "text", "new_key_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "update_secret"("secret_id" "uuid", "new_secret" "text", "new_name" "text", "new_description" "text", "new_key_id" "uuid"); Type: ACL; Schema: vault; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "vault"."update_secret"("secret_id" "uuid", "new_secret" "text", "new_name" "text", "new_description" "text", "new_key_id" "uuid") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "vault"."update_secret"("secret_id" "uuid", "new_secret" "text", "new_name" "text", "new_description" "text", "new_key_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "avg"("public"."halfvec"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "service_role";


--
-- Name: FUNCTION "avg"("public"."vector"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "service_role";


--
-- Name: FUNCTION "sum"("public"."halfvec"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "service_role";


--
-- Name: FUNCTION "sum"("public"."vector"); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "service_role";


--
-- Name: TABLE "pg_stat_statements"; Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON TABLE "extensions"."pg_stat_statements" FROM "postgres";
-- GRANT ALL ON TABLE "extensions"."pg_stat_statements" TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON TABLE "extensions"."pg_stat_statements" TO "dashboard_user";


--
-- Name: TABLE "pg_stat_statements_info"; Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON TABLE "extensions"."pg_stat_statements_info" FROM "postgres";
-- GRANT ALL ON TABLE "extensions"."pg_stat_statements_info" TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON TABLE "extensions"."pg_stat_statements_info" TO "dashboard_user";


--
-- Name: TABLE "ad_sets"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ad_sets" TO "anon";
GRANT ALL ON TABLE "public"."ad_sets" TO "authenticated";
GRANT ALL ON TABLE "public"."ad_sets" TO "service_role";


--
-- Name: TABLE "ads"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ads" TO "anon";
GRANT ALL ON TABLE "public"."ads" TO "authenticated";
GRANT ALL ON TABLE "public"."ads" TO "service_role";


--
-- Name: TABLE "agent_playbooks"; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE "public"."agent_playbooks" TO "authenticated";
GRANT SELECT,INSERT,UPDATE ON TABLE "public"."agent_playbooks" TO "service_role";


--
-- Name: TABLE "chat_confidence_logs"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."chat_confidence_logs" TO "anon";
GRANT ALL ON TABLE "public"."chat_confidence_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_confidence_logs" TO "service_role";


--
-- Name: TABLE "chat_messages"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."chat_messages" TO "anon";
GRANT ALL ON TABLE "public"."chat_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_messages" TO "service_role";


--
-- Name: TABLE "chat_session_hermes_state"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."chat_session_hermes_state" TO "anon";
GRANT ALL ON TABLE "public"."chat_session_hermes_state" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_session_hermes_state" TO "service_role";


--
-- Name: TABLE "chat_session_summaries"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."chat_session_summaries" TO "service_role";


--
-- Name: TABLE "chat_sessions"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."chat_sessions" TO "anon";
GRANT ALL ON TABLE "public"."chat_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_sessions" TO "service_role";


--
-- Name: TABLE "daily_metrics"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."daily_metrics" TO "anon";
GRANT ALL ON TABLE "public"."daily_metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_metrics" TO "service_role";


--
-- Name: TABLE "generated_images"; Type: ACL; Schema: public; Owner: postgres
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."generated_images" TO "anon";
GRANT ALL ON TABLE "public"."generated_images" TO "authenticated";
GRANT ALL ON TABLE "public"."generated_images" TO "service_role";


--
-- Name: TABLE "graph_entities"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."graph_entities" TO "anon";
GRANT ALL ON TABLE "public"."graph_entities" TO "authenticated";
GRANT ALL ON TABLE "public"."graph_entities" TO "service_role";


--
-- Name: TABLE "graph_relations"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."graph_relations" TO "anon";
GRANT ALL ON TABLE "public"."graph_relations" TO "authenticated";
GRANT ALL ON TABLE "public"."graph_relations" TO "service_role";


--
-- Name: TABLE "ingestion_logs"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ingestion_logs" TO "anon";
GRANT ALL ON TABLE "public"."ingestion_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."ingestion_logs" TO "service_role";


--
-- Name: TABLE "market_competitor_ads"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."market_competitor_ads" TO "anon";
GRANT ALL ON TABLE "public"."market_competitor_ads" TO "authenticated";
GRANT ALL ON TABLE "public"."market_competitor_ads" TO "service_role";


--
-- Name: TABLE "market_competitors"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."market_competitors" TO "anon";
GRANT ALL ON TABLE "public"."market_competitors" TO "authenticated";
GRANT ALL ON TABLE "public"."market_competitors" TO "service_role";


--
-- Name: TABLE "market_intelligence_feed"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."market_intelligence_feed" TO "anon";
GRANT ALL ON TABLE "public"."market_intelligence_feed" TO "authenticated";
GRANT ALL ON TABLE "public"."market_intelligence_feed" TO "service_role";


--
-- Name: TABLE "market_trends"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."market_trends" TO "anon";
GRANT ALL ON TABLE "public"."market_trends" TO "authenticated";
GRANT ALL ON TABLE "public"."market_trends" TO "service_role";


--
-- Name: TABLE "rag_email_html"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."rag_email_html" TO "anon";
GRANT ALL ON TABLE "public"."rag_email_html" TO "authenticated";
GRANT ALL ON TABLE "public"."rag_email_html" TO "service_role";


--
-- Name: SEQUENCE "rag_email_html_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE "public"."rag_email_html_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."rag_email_html_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."rag_email_html_id_seq" TO "service_role";


--
-- Name: TABLE "rag_ens"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."rag_ens" TO "anon";
GRANT ALL ON TABLE "public"."rag_ens" TO "authenticated";
GRANT ALL ON TABLE "public"."rag_ens" TO "service_role";


--
-- Name: SEQUENCE "rag_ens_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE "public"."rag_ens_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."rag_ens_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."rag_ens_id_seq" TO "service_role";


--
-- Name: TABLE "rag_marketing"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."rag_marketing" TO "anon";
GRANT ALL ON TABLE "public"."rag_marketing" TO "authenticated";
GRANT ALL ON TABLE "public"."rag_marketing" TO "service_role";


--
-- Name: SEQUENCE "rag_marketing_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE "public"."rag_marketing_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."rag_marketing_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."rag_marketing_id_seq" TO "service_role";


--
-- Name: TABLE "validated_works"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."validated_works" TO "anon";
GRANT ALL ON TABLE "public"."validated_works" TO "authenticated";
GRANT ALL ON TABLE "public"."validated_works" TO "service_role";


--
-- Name: TABLE "campaign_requests"; Type: ACL; Schema: smart_mail; Owner: postgres
--

GRANT SELECT,INSERT,UPDATE ON TABLE "smart_mail"."campaign_requests" TO "authenticated";


--
-- Name: TABLE "knowledge_sources"; Type: ACL; Schema: smart_mail; Owner: postgres
--

GRANT SELECT ON TABLE "smart_mail"."knowledge_sources" TO "authenticated";


--
-- Name: TABLE "secrets"; Type: ACL; Schema: vault; Owner: supabase_admin
--

-- GRANT SELECT,REFERENCES,DELETE,TRUNCATE ON TABLE "vault"."secrets" TO "postgres" WITH GRANT OPTION;
-- GRANT SELECT,DELETE ON TABLE "vault"."secrets" TO "service_role";


--
-- Name: TABLE "decrypted_secrets"; Type: ACL; Schema: vault; Owner: supabase_admin
--

-- GRANT SELECT,REFERENCES,DELETE,TRUNCATE ON TABLE "vault"."decrypted_secrets" TO "postgres" WITH GRANT OPTION;
-- GRANT SELECT,DELETE ON TABLE "vault"."decrypted_secrets" TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";


--
-- Name: issue_graphql_placeholder; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

-- CREATE EVENT TRIGGER "issue_graphql_placeholder" ON "sql_drop"
--          WHEN TAG IN ('DROP EXTENSION')
--    EXECUTE FUNCTION "extensions"."set_graphql_placeholder"();


-- ALTER EVENT TRIGGER "issue_graphql_placeholder" OWNER TO "supabase_admin";

--
-- Name: issue_pg_cron_access; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

-- CREATE EVENT TRIGGER "issue_pg_cron_access" ON "ddl_command_end"
--          WHEN TAG IN ('CREATE EXTENSION')
--    EXECUTE FUNCTION "extensions"."grant_pg_cron_access"();


-- ALTER EVENT TRIGGER "issue_pg_cron_access" OWNER TO "supabase_admin";

--
-- Name: issue_pg_graphql_access; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

-- CREATE EVENT TRIGGER "issue_pg_graphql_access" ON "ddl_command_end"
--          WHEN TAG IN ('CREATE FUNCTION')
--    EXECUTE FUNCTION "extensions"."grant_pg_graphql_access"();


-- ALTER EVENT TRIGGER "issue_pg_graphql_access" OWNER TO "supabase_admin";

--
-- Name: issue_pg_net_access; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

-- CREATE EVENT TRIGGER "issue_pg_net_access" ON "ddl_command_end"
--          WHEN TAG IN ('CREATE EXTENSION')
--    EXECUTE FUNCTION "extensions"."grant_pg_net_access"();


-- ALTER EVENT TRIGGER "issue_pg_net_access" OWNER TO "supabase_admin";

--
-- Name: pgrst_ddl_watch; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

-- CREATE EVENT TRIGGER "pgrst_ddl_watch" ON "ddl_command_end"
--    EXECUTE FUNCTION "extensions"."pgrst_ddl_watch"();


-- ALTER EVENT TRIGGER "pgrst_ddl_watch" OWNER TO "supabase_admin";

--
-- Name: pgrst_drop_watch; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

-- CREATE EVENT TRIGGER "pgrst_drop_watch" ON "sql_drop"
--    EXECUTE FUNCTION "extensions"."pgrst_drop_watch"();


-- ALTER EVENT TRIGGER "pgrst_drop_watch" OWNER TO "supabase_admin";

--
-- PostgreSQL database dump complete
--

-- \unrestrict 2MamsL147WTNhh1PkpXvYCtpeFhpinlNkGoL6aoWKFJQeKWjGmwqqTbU0mNiYnM
