import { useEffect, useRef, useState } from 'react';
import { DEFAULT_NOTIFICATION_PREFERENCES } from './notificationPreferenceClient';
import type { NotificationPreferences, PreferenceClient } from './notificationPreferenceClient';

// All visible state belongs to this client/account. Late loads/saves are ignored
// after unmount or account change; a ref locks double taps before React re-renders.
export function usePreferenceState(client: PreferenceClient) {
  const current = useRef<PreferenceClient | null>(client);
  current.current = client;
  const busy = useRef<PreferenceClient | null>(null);
  const [state, setState] = useState({
    client, preferences: { ...DEFAULT_NOTIFICATION_PREFERENCES },
    ready: false, saving: false, error: '',
  });
  useEffect(() => {
    let active = true;
    current.current = client;
    client.load().then(result => {
      if (active && current.current === client) setState({
        client, preferences: result.preferences, ready: true, saving: false,
        error: result.synced ? (result.cacheSaved ? '' : 'cache') : 'load',
      });
    });
    return () => { active = false; if (current.current === client) current.current = null; };
  }, [client]);
  const own = state.client === client;
  return {
    preferences: own ? state.preferences : { ...DEFAULT_NOTIFICATION_PREFERENCES },
    preferencesLoading: !own || !state.ready,
    savingPreferences: own && state.saving,
    preferenceError: own ? state.error : '',
    updatePreferences: async (patch: Partial<NotificationPreferences>) => {
      if (current.current !== client || !own || !state.ready || busy.current === client) return false;
      busy.current = client;
      setState(previous => ({ ...previous, saving: true, error: '' }));
      try {
        const result = await client.save(patch);
        if (current.current !== client) return false;
        setState({ client, preferences: result.preferences, ready: true, saving: false,
          error: result.cacheSaved ? '' : 'cache' });
        return true;
      } catch {
        if (current.current === client) setState(previous => ({ ...previous, saving: false, error: 'save' }));
        return false;
      } finally {
        if (busy.current === client) busy.current = null;
      }
    },
  };
}

