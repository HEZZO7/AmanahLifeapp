import { supabase } from './supabase';
import { backupClient } from './backupClient';
import { saveNotificationPreferences } from './notificationBackup';

export async function syncNotificationLocation(expectedUserId: string, value: unknown): Promise<boolean> {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session || session.user.id !== expectedUserId) return false;
    await saveNotificationPreferences(backupClient, session.user.id, value);
    return true;
  } catch {
    return false;
  }
}
