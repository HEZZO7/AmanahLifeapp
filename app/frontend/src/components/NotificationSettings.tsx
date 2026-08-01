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
// The 5 categories below are honestly disabled ("Coming soon") rather than
// left live - none of them currently schedule or send anything real. See
// PROJECT.md's Known Issues for what real infrastructure this needs
// (server-side scheduler + protocol-correct Web Push) before they can work.
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
  {
    key: 'general_activity',
    icon: '📱',
    labelEn: 'General Activity',
    labelAr: 'النشاط العام',
    descEn: 'App updates and general notifications',
    descAr: 'تحديثات التطبيق والإشعارات العامة',
  },
];

export default function NotificationSettings() {
  const { language } = useLanguage();
  const {
    isSupported,
    permission,
    preferences,
    loading,
    requestPermission,
    sendLocalNotification,
  } = useNotifications();

  const isAr = language === 'ar';

  const handleEnableNotifications = async () => {
    const granted = await requestPermission();
    if (granted) {
      toast.success(isAr ? 'تم تفعيل الإشعارات بنجاح!' : 'Notifications enabled successfully!');
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

      {/* Notification Type Preferences - disabled, honest "Coming soon".
          Values still save/load normally so nothing is lost once real
          scheduling infrastructure lands. */}
      <div className="space-y-3">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
          {isAr ? 'أنواع الإشعارات' : 'Notification Types'}
        </p>
        {NOTIFICATION_TYPES.map((type) => (
          <div key={type.key} className="flex items-center justify-between opacity-50">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-sm flex-shrink-0">{type.icon}</span>
              <div className="min-w-0">
                <p className="text-foreground text-sm truncate">
                  {isAr ? type.labelAr : type.labelEn}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {isAr ? 'قريباً - متوفر على أندرويد' : 'Coming soon - available on Android'}
                </p>
              </div>
            </div>
            {/* Disabled, not removed - still reflects the stored preference
                value so nothing looks lost, it just can't be changed here
                since it doesn't gate anything real yet. */}
            <button
              disabled
              aria-disabled="true"
              className={`w-10 h-5 rounded-full relative flex-shrink-0 ml-2 cursor-not-allowed ${
                preferences[type.key] ? 'bg-primary/40' : 'bg-secondary'
              }`}
            >
              <div className={`w-3.5 h-3.5 rounded-full bg-white/70 absolute top-[3px] ${
                preferences[type.key] ? 'left-[22px]' : 'left-[3px]'
              }`} />
            </button>
          </div>
        ))}
      </div>

      {/* Info text */}
      {permission === 'granted' && (
        <p className="text-xs text-muted-foreground mt-3">
          {isAr
            ? 'تعمل تذكيرات الصلاة أدناه بالفعل. الأنواع الأخرى قيد التطوير.'
            : 'Prayer reminders below already work. Other types are still in development.'}
        </p>
      )}
    </div>
  );
}
