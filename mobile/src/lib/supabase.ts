import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

type ExpoExtra = {
  supabaseUrl?: string;
  supabasePublishableKey?: string;
};

function resolveSupabaseConfig(): { url: string; key: string } {
  const extra = Constants.expoConfig?.extra as ExpoExtra | undefined;
  return {
    url: process.env.EXPO_PUBLIC_SUPABASE_URL ?? extra?.supabaseUrl ?? '',
    key:
      process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? extra?.supabasePublishableKey ?? '',
  };
}

export function isSupabaseConfigured(): boolean {
  const { url, key } = resolveSupabaseConfig();
  return url.length > 0 && key.length > 0;
}

let supabaseClient: SupabaseClient | null = null;

/** Lazy Supabase client — returns null when URL/key are not configured (avoids startup crash). */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!supabaseClient) {
    const { url, key } = resolveSupabaseConfig();
    supabaseClient = createClient(url, key, {
      auth: {
        storage: ExpoSecureStoreAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }
  return supabaseClient;
}
