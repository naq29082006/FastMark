import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

import { createLogger } from '../utils/logger';
import { getSupabaseConfig, getSupabaseConfigError } from './env';

const log = createLogger('Supabase');

let supabaseClient;

function createSupabaseClient() {
  const { url, anonKey } = getSupabaseConfig();
  const configError = getSupabaseConfigError();

  if (configError) {
    log.fail('init', configError);
    throw new Error(configError);
  }

  const client = createClient(url, anonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });

  log.info('init:ok', { url });
  return client;
}

export function getSupabaseClient() {
  if (!supabaseClient) {
    supabaseClient = createSupabaseClient();
  }

  return supabaseClient;
}

export function isSupabaseConfigured() {
  return !getSupabaseConfigError();
}

export function ensureSupabaseClient() {
  return getSupabaseClient();
}
