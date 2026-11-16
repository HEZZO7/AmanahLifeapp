import { createClient } from '@supabase/supabase-js';

const LIVE_URL = 'https://nyhsnvjdgifphwkqzwel.supabase.co';
const LIVE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55aHNudmpkZ2lmcGh3a3F6d2VsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxNDE2ODAsImV4cCI6MjA5NDcxNzY4MH0.dFdjuFJjlhxpRySsJGzflgrR-2A1IVlS37wF15319Og';

export const IS_STAGING = import.meta.env.VITE_AMANAH_ENV === 'staging';
const stageUrl = import.meta.env.VITE_SUPABASE_URL;
const stageKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (IS_STAGING && (!stageUrl || !stageKey || !/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(stageUrl) || stageUrl === LIVE_URL || stageKey === LIVE_KEY)) {
  throw new Error('Staging requires an independent Supabase project and public key');
}
export const SUPABASE_URL = IS_STAGING ? stageUrl : LIVE_URL;
export const supabase = createClient(SUPABASE_URL, IS_STAGING ? stageKey : LIVE_KEY, IS_STAGING ? {
  global: { fetch: (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.origin !== new URL(SUPABASE_URL).origin) throw new Error('Blocked non-staging Supabase request');
    return fetch(input, init);
  } }
} : undefined);