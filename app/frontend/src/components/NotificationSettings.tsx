import { useNotifications, NotificationPreferences } from '@/hooks/useNotifications';
import { useLanguage } from '@/contexts/LanguageContext';
import { Bell, BellOff, BellRing } from 'lucide-react';
import { toast } from 'sonner';

interface NotificationType {
  key: keyof NotificationPreferences;
  icon: string;
  labelEn: string;
  labelAr: string;
  descEn: string;
  descAr: string;
}

// prayer_reminders intentionally omitted - the real, working prayer-reminder
// control (per-prayer enable + minutes-before, real Aladhan-backed
// scheduling) is the dedicated PrayerReminderSettings panel rendered right
// below this one on the Settings page. A second, non-functional "prayer"
// toggle here would just be confusing next to it.
//
// These 4 categories are now real: VAPID Web Push + a cron-driven server
// sweep (Bill/Habit&Goal/Fasting) or event-triggered send (Savings) bring
// them to parity with Android's real expo-notifications scheduling. See
// PROJECT.md for the push-infra build.
const NOTIFICATION_TYPES: NotificationType[] = [
  {
    key: 'bill_reminders',
    icon: '💳',
    labelEn: 'Bill Payment Reminders',
    labelAr: 'تذكير دفع الفواتير',
    descEn: 'Reminders for upcoming bill payments',
    descAr: 'تذكير بمواعيد دفع الفواتير',
  },
  {
    key: 'habit_reminders',
    icon: '🎯',
    labelEn: 'Habit & Goal Reminders',
    labelAr: 'تذكير العادات والأهداف',
    descEn: 'Stay on track with your habits and goals',
    descAr: 'ابقَ على المسار مع عاداتك وأهدافك',
  },
  {
    key: 'fasting_reminders',
    icon: '🌙',
    labelEn: 'Fasting Reminders',
    labelAr: 'تذكير الصيام',
    descEn: 'Suhoor and Iftar time alerts',
    descAr: 'تنبيهات وقت السحور والإفطار',
  },
  {
    key: 'savings_reminders',
    icon: '💰',
    labelEn: 'Savings Challenge Reminders',
    labelAr: 'تذكير تحديات الادخار',
    descEn: 'Reminders for your savings challenges',
    descAr: 'تذكير بتحديات الادخار الخاصة بك',
  },
];

// General Activity has no real scheduled content on EITHER platform today -
// stays honestly disabled ("Coming soon") rather than wired to a toggle
// that would gate nothing. Flagged in PROJECT.md as a separate future item
// needing a product decision on real content first, not bundled into the
// push-infra build the 4 categories above are part of.
const DISABLED_NOTIFICATION_TYPE: NotificationType = {
  key: 'general_activity',
  icon: '📱',
  labelEn: 'General Activity',
  labelAr: 'النشاط العام',
  descEn: 'App updates and general notifications',
  descAr: 'تحديثات التطبيق والإشعارات العامة',
};

export default function NotificationSettings() {
  const { language } = useLanguage();
  const {
    isSupported,
    permission,
    preferences,
    loading,
    requestPermission,
    updatePreferences,
    sendLocalNotification,
    subscribeToPush,
  } = useNotifications();

  const isAr = language === 'ar';

  const handleEnableNotifications = async () => {
    const granted = await requestPermission();
    if (granted) {
      toast.success(isAr ? 'تم تفعيل الإشعارات بنجاح!' : 'Notifications enabled successfully!');
      subscribeToPush();
      setTimeout(() => {
        sendLocalNotification(
          isAr ? 'مرحباً!' : 'Welcome!',
          isAr ? 'تم تفعيل الإشعارات لتذكيرات الصلاة.' : 'Notifications are active for prayer reminders.',
          { tag: 'welcome' }
        );
      }, 1000);
    } else {
      toast.error(
        isAr
          ? 'تم رفض إذن الإشعارات. يرجى تفعيلها من إعدادات المتصفح.'
          : 'Notification permission denied. Please enable in browser settings.'
      );
    }
  };

  if (loading) {
    return (
      <div className="bg-card rounded-2xl p-4 border border-border animate-pulse">
        <div className="h-5 bg-muted rounded w-32 mb-3" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-10 bg-muted rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!isSupported) {
    return (
      <div className="bg-card rounded-2xl p-4 border border-border">
        <div className="flex items-center gap-2 mb-3">
          <BellOff className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm text-muted-foreground">
            {isAr ? 'الإشعارات' : 'Notifications'}
          </h3>
        </div>
        <p className="text-xs text-muted-foreground">
          {isAr
            ? 'الإشعارات غير مدعومة في هذا المتصفح.'
            : 'Push notifications are not supported in this browser.'}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl p-4 border border-border">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BellRing className="w-4 h-4 text-primary" />
          <h3 className="text-sm text-muted-foreground">
            {isAr ? 'الإشعارات' : 'Notifications'}
          </h3>
        </div>
        {permission === 'denied' && (
          <span className="text-[10px] text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">
            {isAr ? 'محظور' : 'Blocked'}
          </span>
        )}
      </div>

      {/* Permission request - one-shot, matches the browser's own permission
          model (a site can request it, but can't toggle it back off itself;
          the user does that from browser settings, reflected below via the
          'denied' badge/messaging). */}
      {permission === 'denied' ? (
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3 mb-3">
          <p className="text-xs text-red-400">
            {isAr
              ? 'تم حظر الإشعارات. لتفعيلها، افتح إعدادات المتصفح وقم بالسماح بالإشعارات لهذا الموقع.'
              : 'Notifications are blocked. To enable them, open your browser settings and allow notifications for this site.'}
          </p>
        </div>
      ) : permission !== 'granted' ? (
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-foreground" />
            <span className="text-foreground text-sm">
              {isAr ? 'تفعيل الإشعارات' : 'Enable Notifications'}
            </span>
          </div>
          <button
            onClick={handleEnableNotifications}
            className="px-3 py-1.5 rounded-full bg-primary text-white text-xs font-medium"
          >
            {isAr ? 'تفعيل' : 'Enable'}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border text-primary">
          <Bell className="w-4 h-4" />
          <span className="text-sm">{isAr ? 'الإشعارات مفعّلة' : 'Notifications enabled'}</span>
        </div>
      )}

      {/* Notification Type Preferences - the 4 real categories are live,
          interactive toggles now (real Web Push + server scheduling).
          General Activity stays disabled below since it has no real
          content to gate on either platform yet. */}
      <div className="space-y-3">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
          {isAr ? 'أنواع الإشعارات' : 'Notification Types'}
        </p>
        {NOTIFICATION_TYPES.map((type) => {
          const enabled = preferences[type.key] !== false;
          return (
            <div key={type.key} className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-sm flex-shrink-0">{type.icon}</span>
                <div className="min-w-0">
                  <p className="text-foreground text-sm truncate">
                    {isAr ? type.labelAr : type.labelEn}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {isAr ? type.descAr : type.descEn}
                  </p>
                </div>
              </div>
              <button
                onClick={() => updatePreferences({ [type.key]: !enabled })}
                className={`w-10 h-5 rounded-full relative flex-shrink-0 ml-2 transition-all ${
                  enabled ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-[3px] transition-all ${
                  enabled ? 'left-[19px]' : 'left-[3px]'
                }`} />
              </button>
            </div>
          );
        })}

        <div className="flex items-center justify-between opacity-50 pt-1 border-t border-border/50">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-sm flex-shrink-0">{DISABLED_NOTIFICATION_TYPE.icon}</span>
            <div className="min-w-0">
              <p className="text-foreground text-sm truncate">
                {isAr ? DISABLED_NOTIFICATION_TYPE.labelAr : DISABLED_NOTIFICATION_TYPE.labelEn}
              </p>
              <p className="text-[10px] text-muted-foreground truncate">
                {isAr ? 'قريباً' : 'Coming soon'}
              </p>
            </div>
          </div>
          <button
            disabled
            aria-disabled="true"
            className="w-10 h-5 rounded-full relative flex-shrink-0 ml-2 cursor-not-allowed bg-muted"
          >
            <div className="w-3.5 h-3.5 rounded-full bg-muted-foreground/40 absolute top-[3px] left-[3px]" />
          </button>
        </div>
      </div>

      {permission !== 'granted' && (
        <p className="text-xs text-muted-foreground mt-3">
          {isAr
            ? 'فعّل الإشعارات أعلاه لتلقي هذه التذكيرات فعلياً.'
            : 'Enable notifications above to actually receive these reminders.'}
        </p>
      )}
    </div>
  );
}
