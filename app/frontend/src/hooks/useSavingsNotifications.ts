import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

const NOTIFICATION_STORAGE_KEY = 'amanah-savings-notifications';
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const PUSH_NOTIFY_URL = 'https://nyhsnvjdgifphwkqzwel.supabase.co/functions/v1/app_11941c8fec_push_notify';

// Real background push for a milestone, on top of the direct in-tab
// Notification() call below - this is the ONLY category (of the 4 brought
// to real parity) that's event-triggered rather than cron-swept, matching
// Android's own trigger:null "send now" pattern exactly (see
// savings-challenges.tsx's addSavings()). Gated server-side by
// push_notify's own savings_reminders preference check - this hook's own
// isEnabled flag below stays a separate, purely local "instant in-tab
// celebration" preference, not merged with it, since they're genuinely
// different capabilities (foreground-only vs background-capable) with no
// reason to force one shared toggle.
async function sendRealMilestonePush(userId: string | null, title: string, body: string) {
  if (!userId) return;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await fetch(PUSH_NOTIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ action: 'send_notification', user_id: userId, notification_type: 'savings', title, body }),
    });
  } catch { /* best-effort - the in-tab celebration above already covers the foreground case */ }
}

interface NotificationPrefs {
  enabled: boolean;
  lastReminderTime: string | null;
}

function getStoredPrefs(): NotificationPrefs {
  try {
    const stored = localStorage.getItem(NOTIFICATION_STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return { enabled: false, lastReminderTime: null };
}

function savePrefs(prefs: NotificationPrefs) {
  localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(prefs));
}

function getPermissionStatus(): NotificationPermission {
  if (!('Notification' in window)) return 'denied';
  return Notification.permission;
}

function sendNotification(title: string, body: string, icon?: string) {
  if (getPermissionStatus() !== 'granted') return;
  try {
    new Notification(title, { body, icon: icon || '🏆' });
  } catch { /* ignore - some browsers block */ }
}

export function useSavingsNotifications(language: string, userId: string | null = null) {
  const isAr = language === 'ar';
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>(getPermissionStatus());
  const [isEnabled, setIsEnabled] = useState<boolean>(getStoredPrefs().enabled);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkAndSendReminder = useCallback(() => {
    const prefs = getStoredPrefs();
    if (!prefs.enabled) return;
    if (getPermissionStatus() !== 'granted') return;

    const now = Date.now();
    const lastTime = prefs.lastReminderTime ? new Date(prefs.lastReminderTime).getTime() : 0;
    const hoursSinceLast = (now - lastTime) / (1000 * 60 * 60);

    if (hoursSinceLast >= 24) {
      const title = isAr ? '💰 تذكير الادخار' : '💰 Savings Reminder';
      const body = isAr
        ? 'لا تنسَ إضافة مدخراتك اليوم! كل مبلغ صغير يُحدث فرقاً.'
        : "Don't forget to add your savings today! Every small amount makes a difference.";
      sendNotification(title, body);
      savePrefs({ ...prefs, lastReminderTime: new Date().toISOString() });
    }
  }, [isAr]);

  useEffect(() => {
    if (isEnabled && permissionStatus === 'granted') {
      checkAndSendReminder();
      intervalRef.current = setInterval(checkAndSendReminder, CHECK_INTERVAL_MS);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isEnabled, permissionStatus, checkAndSendReminder]);

  const enableNotifications = useCallback(async () => {
    if (!('Notification' in window)) return;

    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }
    setPermissionStatus(permission);

    if (permission === 'granted') {
      setIsEnabled(true);
      savePrefs({ enabled: true, lastReminderTime: getStoredPrefs().lastReminderTime });
    }
  }, []);

  const disableNotifications = useCallback(() => {
    setIsEnabled(false);
    const prefs = getStoredPrefs();
    savePrefs({ ...prefs, enabled: false });
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const celebrateMilestone = useCallback((challengeName: string, percentage: number) => {
    const milestoneEmojis: Record<number, string> = { 25: '🌱', 50: '🔥', 75: '⭐', 100: '🏆' };
    const emoji = milestoneEmojis[percentage] || '🎉';

    const title = isAr
      ? `${emoji} مبروك! إنجاز جديد`
      : `${emoji} Milestone Reached!`;
    const body = isAr
      ? `وصلت إلى ${percentage}% في تحدي "${challengeName}"! استمر في التقدم!`
      : `You reached ${percentage}% in "${challengeName}"! Keep going!`;

    // In-tab celebration - this hook's own local preference.
    if (getPermissionStatus() === 'granted' && getStoredPrefs().enabled) {
      sendNotification(title, body);
    }
    // Real background-capable push - gated server-side by the account's
    // savings_reminders preference, independent of the local flag above.
    sendRealMilestonePush(userId, title, body);
  }, [isAr, userId]);

  return {
    permissionStatus,
    isEnabled,
    enableNotifications,
    disableNotifications,
    celebrateMilestone,
  };
}