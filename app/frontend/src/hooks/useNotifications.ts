import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

const SUPABASE_URL = 'https://nyhsnvjdgifphwkqzwel.supabase.co';
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/app_11941c8fec_push_notify`;

export interface NotificationPreferences {
  prayer_reminders: boolean;
  bill_reminders: boolean;
  habit_reminders: boolean;
  fasting_reminders: boolean;
  savings_reminders: boolean;
  general_activity: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  prayer_reminders: true,
  bill_reminders: true,
  habit_reminders: true,
  fasting_reminders: true,
  savings_reminders: true,
  general_activity: true,
};

export type NotificationPermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

/**
 * Handles Notification permission + service-worker registration only.
 *
 * Web Push (subscribing to app_11941c8fec_push_notify's `subscribe` action
 * via pushManager.subscribe) was removed here - it only ever used a
 * hardcoded placeholder VAPID public key (a well-known Web Push tutorial
 * demo key, not one paired with any real private key on our server), so
 * every subscription it created could never actually receive a push. See
 * PROJECT.md's Known Issues for the real-infrastructure follow-up
 * (server-side scheduler + protocol-correct VAPID Web Push) this needs
 * before subscribing can mean anything again.
 *
 * permission/isSupported are still real and still needed:
 * PrayerReminderSettings.tsx's setTimeout-based same-day scheduler and
 * sendLocalNotification below both call swRegistration.showNotification,
 * which requires Notification permission + an active service worker, not
 * a push subscription.
 */
export function useNotifications() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermissionState>('default');
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);

  const isSupported = 'serviceWorker' in navigator && 'Notification' in window;

  useEffect(() => {
    if (!isSupported) {
      setPermission('unsupported');
      setLoading(false);
      return;
    }

    setPermission(Notification.permission as NotificationPermissionState);

    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        setSwRegistration(registration);
      })
      .catch((err) => {
        console.error('SW registration failed:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isSupported]);

  // Load preferences from backend
  useEffect(() => {
    if (!user) return;

    const loadPreferences = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const response = await fetch(EDGE_FUNCTION_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ action: 'get_preferences' }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.preferences) {
            setPreferences({
              prayer_reminders: data.preferences.prayer_reminders ?? true,
              bill_reminders: data.preferences.bill_reminders ?? true,
              habit_reminders: data.preferences.habit_reminders ?? true,
              fasting_reminders: data.preferences.fasting_reminders ?? true,
              savings_reminders: data.preferences.savings_reminders ?? true,
              general_activity: data.preferences.general_activity ?? true,
            });
          }
        }
      } catch (err) {
        console.error('Failed to load notification preferences:', err);
      }
    };

    loadPreferences();
  }, [user]);

  // Request Notification permission only - no push subscription.
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;

    try {
      const result = await Notification.requestPermission();
      setPermission(result as NotificationPermissionState);
      return result === 'granted';
    } catch (err) {
      console.error('Permission request failed:', err);
      return false;
    }
  }, [isSupported]);

  // Update notification preferences. Values are still saved even for the
  // categories currently disabled in the UI, so nothing is lost once real
  // scheduling infrastructure lands for them.
  const updatePreferences = useCallback(async (newPrefs: Partial<NotificationPreferences>) => {
    const updated = { ...preferences, ...newPrefs };
    setPreferences(updated);

    if (!user) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await fetch(EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'update_preferences',
          preferences: updated,
        }),
      });
    } catch (err) {
      console.error('Failed to update preferences:', err);
    }
  }, [preferences, user]);

  // Send a local notification (for testing / immediate notifications) -
  // shows directly via the service worker, no network push involved.
  const sendLocalNotification = useCallback((title: string, body: string, options?: { icon?: string; url?: string; tag?: string }) => {
    if (permission !== 'granted') return;

    if (swRegistration) {
      swRegistration.showNotification(title, {
        body,
        icon: options?.icon || 'https://mgx-backend-cdn.metadl.com/generate/images/1249149/2026-07-03/rxebjjaaaira/amanah-logo_variant_3.png',
        badge: 'https://mgx-backend-cdn.metadl.com/generate/images/1249149/2026-07-03/rxecotaaairq/amanah-logo_variant_4.png',
        vibrate: [100, 50, 100],
        data: { url: options?.url || '/' },
        tag: options?.tag || 'general',
      });
    }
  }, [permission, swRegistration]);

  return {
    isSupported,
    permission,
    preferences,
    loading,
    requestPermission,
    updatePreferences,
    sendLocalNotification,
  };
}
