import type { Backend } from './backend';
import { createMockBackend } from './mockBackend';
import { createSupabaseBackend } from './supabaseBackend';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_KEY as string | undefined;

const unconfigured = {
  configured: false,
} as Backend;

function pick(): Backend {
  // Локальный бэкенд — только в сборке для разработки/автотестов, в рабочую не попадает.
  if (import.meta.env.VITE_BACKEND === 'mock') return createMockBackend();
  if (url && key) return createSupabaseBackend(url, key);
  return unconfigured;
}

export const backend: Backend = pick();
