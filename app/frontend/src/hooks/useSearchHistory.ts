import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface SearchHistoryItem {
  id: string;
  query: string;
  search_type: 'classic' | 'ai';
  created_at: string;
}

const TABLE_NAME = 'app_11941c8fec_search_history';

export function useSearchHistory(searchType: 'classic' | 'ai') {
  const { user } = useAuth();
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchHistory = useCallback(async () => {
    if (!user) {
      setHistory([]);
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('id, query, search_type, created_at')
        .eq('user_id', user.id)
        .eq('search_type', searchType)
        .order('created_at', { ascending: false })
        .limit(20);

      if (!error && data) {
        setHistory(data as SearchHistoryItem[]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [user, searchType]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const addSearch = useCallback(async (query: string) => {
    if (!user || !query.trim()) return;

    const trimmedQuery = query.trim();

    // Check if this query already exists for deduplication
    const { data: existing } = await supabase
      .from(TABLE_NAME)
      .select('id')
      .eq('user_id', user.id)
      .eq('query', trimmedQuery)
      .eq('search_type', searchType)
      .limit(1);

    if (existing && existing.length > 0) {
      // Update timestamp of existing entry
      await supabase
        .from(TABLE_NAME)
        .update({ created_at: new Date().toISOString() })
        .eq('id', existing[0].id);
    } else {
      // Insert new entry
      await supabase
        .from(TABLE_NAME)
        .insert({
          user_id: user.id,
          query: trimmedQuery,
          search_type: searchType,
        });
    }

    // Refresh history
    await fetchHistory();
  }, [user, searchType, fetchHistory]);

  const deleteSearch = useCallback(async (id: string) => {
    if (!user) return;

    await supabase
      .from(TABLE_NAME)
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    setHistory(prev => prev.filter(item => item.id !== id));
  }, [user]);

  const clearHistory = useCallback(async () => {
    if (!user) return;

    await supabase
      .from(TABLE_NAME)
      .delete()
      .eq('user_id', user.id)
      .eq('search_type', searchType);

    setHistory([]);
  }, [user, searchType]);

  return { history, addSearch, deleteSearch, clearHistory, isLoading };
}