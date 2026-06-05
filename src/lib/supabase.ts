import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import ws from 'ws';

/**
 * Server-side Supabase client using the service role key.
 * NEVER import this from client components — the service role key
 * bypasses RLS and must stay on the server.
 */
let cachedClient: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function getSupabaseAdmin(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Supabase is not configured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY',
    );
  }

  cachedClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    // We never use realtime, but the client constructs it eagerly and needs a
    // WebSocket implementation on Node < 22
    ...(typeof WebSocket === 'undefined'
      ? { realtime: { transport: ws as unknown as typeof WebSocket } }
      : {}),
  });
  return cachedClient;
}
