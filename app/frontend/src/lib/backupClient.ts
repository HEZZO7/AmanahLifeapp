import { supabase } from './supabase';
import type { BackupClient } from './notificationBackup';

export const backupClient: BackupClient = {
  read: async (table, columns, userId, offset) => supabase.from(table)
    .select(columns.join(',')).eq('user_id', userId)
    .order(table === 'app_11941c8fec_search_history' ? 'id' : 'user_id')
    .range(offset, offset + 999),
  update: async (table, row, userId) => supabase.from(table)
    .update(row).eq('user_id', userId).select('user_id'),
  insert: async (table, rows) => supabase.from(table).insert(rows),
  remove: async (table, userId) => supabase.from(table).delete().eq('user_id', userId),
};
