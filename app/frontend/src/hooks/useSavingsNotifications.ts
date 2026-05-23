import { useState, useEffect, useCallback, useRef } from 'react';

const NOTIFICATION_STORAGE_KEY = 'amanah-savings-notifications';
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

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

export function useSavingsNotifications(language: string) {
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
    if (getPermissionStatus() !== 'granted') return;
    if (!getStoredPrefs().enabled) return;

    const milestoneEmojis: Record<number, string> = { 25: '🌱', 50: '🔥', 75: '⭐', 100: '🏆' };
    const emoji = milestoneEmojis[percentage] || '🎉';

    const title = isAr
      ? `${emoji} مبروك! إنجاز جديد`
      : `${emoji} Milestone Reached!`;
    const body = isAr
      ? `وصلت إلى ${percentage}% في تحدي "${challengeName}"! استمر في التقدم!`
      : `You reached ${percentage}% in "${challengeName}"! Keep going!`;

    sendNotification(title, body);
  }, [isAr]);

  return {
    permissionStatus,
    isEnabled,
    enableNotifications,
    disableNotifications,
    celebrateMilestone,
  };
}