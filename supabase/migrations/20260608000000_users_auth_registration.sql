-- Backend auth registration must write to public.users before the user has a JWT.
-- users_insert_own requires auth.uid() = id, which is NULL for service-role server writes
-- when RLS bypass is not active. These policies + SECURITY DEFINER RPC ensure registration works.

CREATE POLICY "users_service_role_all" ON users
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.upsert_user_profile_on_auth(
  p_user_id UUID,
  p_phone_hash TEXT,
  p_phone_encrypted TEXT,
  p_display_name TEXT,
  p_avatar_colour TEXT
)
RETURNS TABLE (display_name TEXT, avatar_colour TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO users (id, phone_hash, phone_encrypted, display_name, avatar_colour)
  VALUES (p_user_id, p_phone_hash, p_phone_encrypted, p_display_name, p_avatar_colour)
  ON CONFLICT (id) DO UPDATE SET
    phone_hash = EXCLUDED.phone_hash,
    phone_encrypted = EXCLUDED.phone_encrypted,
    display_name = EXCLUDED.display_name,
    avatar_colour = COALESCE(users.avatar_colour, EXCLUDED.avatar_colour),
    updated_at = NOW();

  RETURN QUERY
  SELECT u.display_name, u.avatar_colour
  FROM users u
  WHERE u.id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_user_profile_on_auth(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_user_profile_on_auth(UUID, TEXT, TEXT, TEXT, TEXT) TO service_role;
