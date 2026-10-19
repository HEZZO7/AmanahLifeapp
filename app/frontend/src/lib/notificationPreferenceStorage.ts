import { supabase } from './supabase';
import { createNotificationPreferenceWriter } from './notificationPreferenceWrite';

// Shared queue for prayer synchronization and notification backup restores.
export const notificationPreferenceStorage = createNotificationPreferenceWriter(supabase);
