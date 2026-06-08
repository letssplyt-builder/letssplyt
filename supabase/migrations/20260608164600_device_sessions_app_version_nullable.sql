-- Align device_sessions with schema: app_version is optional until the app reports it.

ALTER TABLE public.device_sessions
  ALTER COLUMN app_version DROP NOT NULL;
