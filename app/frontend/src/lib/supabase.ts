import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nyhsnvjdgifphwkqzwel.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55aHNudmpkZ2lmcGh3a3F6d2VsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxNDE2ODAsImV4cCI6MjA5NDcxNzY4MH0.dFdjuFJjlhxpRySsJGzflgrR-2A1IVlS37wF15319Og';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);