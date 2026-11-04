CREATE TABLE IF NOT EXISTS public.cron_tokens (
  name text PRIMARY KEY,
  token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.cron_tokens TO service_role;
ALTER TABLE public.cron_tokens ENABLE ROW LEVEL SECURITY;
-- Deliberately no policies: unreachable from anon/authenticated clients.

INSERT INTO public.cron_tokens (name, token)
VALUES ('scheduler', encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (name) DO NOTHING;