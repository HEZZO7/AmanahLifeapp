import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { createPreferenceClient } from '@/lib/notificationPreferenceClient';
import { usePreferenceState } from '@/lib/usePreferenceState';
export type { NotificationPreferences } from '@/lib/notificationPreferenceClient';

const SUPABASE_URL = 'https://nyhsnvjdgifphwkqzwel.supabase.co';
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/app_11941c8fec_push_notify`;

// Real VAPID public key - safe to ship in client source (that's the whole
// point of the public/private VAPID split, same as any other publishable
// key in this app). Generated 2026-08-09 alongside real Supabase secrets
// for the matching private key - see PROJECT.md for the push-infra build
// this replaced the old hardcoded Web Push tutorial demo key with.
const VAPID_PUBLIC_KEY = 'BMUp_FS7rsxaOSVNK70SzGGFPIx3tKtDNIB4IWfKq2dEZzJ4awMAtgunI8npER14GSMwOFn7hBUjgIWqSF2kJdg';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export type NotificationPermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

/**
 * Handles Notification permission, service-worker registration, real Web
 * Push subscription, and notification-category preferences.
 *
 * subscribeToPush (real pushManager.subscribe, real VAPID key) replaces
 * what used to be dead code here - the previous implementation used a
 * hardcoded placeholder VAPID public key (a well-known Web Push tutorial
 * demo key, not one paired with any real private key on the server), so
 * every subscription it created could never actually receive a push, and
 * it was removed outright rather than ship something that silently didn't
 * work. Real VAPID keys + a spec-correct (VAPID JWT + AES128GCM) sender in
 * app_11941c8fec_push_notify now make this real - see PROJECT.md for the
 * full push-infra build this is part of.
 */
export function useNotifications() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermissionState>('default');
  const accountId = user?.id ?? null;
  const preferenceClient = useMemo(() => createPreferenceClient(accountId, {
    url: EDGE_FUNCTION_URL,
    getSession: async () => (await supabase.auth.getSession()).data.session,
    request: (...args) => fetch(...args),
    readCache: async () => null, // Web has no persistent preference cache.
    writeCache: async () => undefined,
  }), [accountId]);
  const { preferences, preferencesLoading, savingPreferences, preferenceError, updatePreferences } = usePreferenceState(preferenceClient);
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

  // Real pushManager.subscribe(), sent to push_notify's `subscribe` action
  // (already a real, working DB writer - only the send side was broken
  // before this build). One subscription per browser/device; which
  // categories it actually receives is controlled entirely by preferences,
  // not by re-subscribing per category.
  const subscribeToPush = useCallback(async (): Promise<boolean> => {
    if (!swRegistration || !user) return false;
    try {
      let subscription = await swRegistration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await swRegistration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;

      const subJson = subscription.toJSON();
      const response = await fetch(EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: 'subscribe', subscription: subJson }),
      });
      return response.ok;
    } catch (err) {
      console.error('Push subscribe failed:', err);
      return false;
    }
  }, [swRegistration, user]);

  // Subscribe automatically once permission is already granted and the
  // service worker + signed-in user are both ready - covers a returning
  // user who granted permission in an earlier session, not just the
  // one-shot Enable button click below.
  useEffect(() => {
    if (permission === 'granted' && swRegistration && user) {
      subscribeToPush();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permission, swRegistration, user]);

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
    preferencesLoading,
    savingPreferences,
    preferenceError,
    requestPermission,
    updatePreferences,
    sendLocalNotification,
    subscribeToPush,
  };
}

