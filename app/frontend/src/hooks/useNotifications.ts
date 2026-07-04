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

export function useNotifications() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermissionState>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);

  // Check if push notifications are supported
  const isSupported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

  // Initialize service worker and check status
  useEffect(() => {
    if (!isSupported) {
      setPermission('unsupported');
      setLoading(false);
      return;
    }

    setPermission(Notification.permission as NotificationPermissionState);

    // Register service worker
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        setSwRegistration(registration);
        return registration.pushManager.getSubscription();
      })
      .then((subscription) => {
        setIsSubscribed(!!subscription);
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

  // Request notification permission and subscribe
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;

    try {
      const result = await Notification.requestPermission();
      setPermission(result as NotificationPermissionState);

      if (result === 'granted') {
        await subscribeToPush();
        return true;
      }
      return false;
    } catch (err) {
      console.error('Permission request failed:', err);
      return false;
    }
  }, [isSupported, swRegistration, user]);

  // Subscribe to push notifications
  const subscribeToPush = useCallback(async () => {
    if (!swRegistration || !user) return;

    try {
      // Use a VAPID public key placeholder - in production this would come from env
      const vapidPublicKey = localStorage.getItem('amanah_vapid_public_key') || 
        'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkOs-qy_MUlGfGFVQfO-Q8-0CDxBAEnwIFKjXvVGg0';
      
      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

      const subscription = await swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      // Save subscription to backend
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'subscribe',
          subscription: subscription.toJSON(),
        }),
      });

      if (response.ok) {
        setIsSubscribed(true);
      }
    } catch (err) {
      console.error('Push subscription failed:', err);
    }
  }, [swRegistration, user]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async () => {
    if (!swRegistration || !user) return;

    try {
      const subscription = await swRegistration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();

        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await fetch(EDGE_FUNCTION_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              action: 'unsubscribe',
              endpoint: subscription.endpoint,
            }),
          });
        }
      }
      setIsSubscribed(false);
    } catch (err) {
      console.error('Unsubscribe failed:', err);
    }
  }, [swRegistration, user]);

  // Update notification preferences
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

  // Send a local notification (for testing / immediate notifications)
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
    isSubscribed,
    preferences,
    loading,
    requestPermission,
    unsubscribe,
    updatePreferences,
    sendLocalNotification,
  };
}

// Utility: Convert VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}