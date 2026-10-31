import { createClient } from '@supabase/supabase-js';
import { PROJECT_URL } from './serviceEnvironment';

// No implicit hosted project/key. Test and live builds select the same project
// for authentication and checkout through explicit VITE_SUPABASE_* settings.
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = createClient(PROJECT_URL, anonKey || 'configuration-required');
