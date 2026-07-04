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

const NOTIFICATION_TYPES: NotificationType[] = [
  {
    key: 'prayer_reminders',
    icon: '🕌',
    labelEn: 'Prayer Reminders',
    labelAr: 'تذكير الصلاة',
    descEn: 'Get notified before prayer times',
    descAr: 'تنبيه قبل أوقات الصلاة',
  },
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
    isSubscribed,
    preferences,
    loading,
    requestPermission,
    unsubscribe,
    updatePreferences,
    sendLocalNotification,
  } = useNotifications();

  const isAr = language === 'ar';

  const handleEnableNotifications = async () => {
    const granted = await requestPermission();
    if (granted) {
      toast.success(isAr ? 'تم تفعيل الإشعارات بنجاح!' : 'Notifications enabled successfully!');
      // Send a test notification
      setTimeout(() => {
        sendLocalNotification(
          isAr ? 'مرحباً!' : 'Welcome!',
          isAr ? 'تم تفعيل الإشعارات. ستتلقى تذكيرات مهمة.' : 'Notifications are active. You\'ll receive important reminders.',
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

  const handleDisableNotifications = async () => {
    await unsubscribe();
    toast.success(isAr ? 'تم إيقاف الإشعارات' : 'Notifications disabled');
  };

  const handleTogglePreference = (key: keyof NotificationPreferences) => {
    updatePreferences({ [key]: !preferences[key] });
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

      {/* Permission / Enable Toggle */}
      {permission === 'denied' ? (
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3 mb-3">
          <p className="text-xs text-red-400">
            {isAr
              ? 'تم حظر الإشعارات. لتفعيلها، افتح إعدادات المتصفح وقم بالسماح بالإشعارات لهذا الموقع.'
              : 'Notifications are blocked. To enable them, open your browser settings and allow notifications for this site.'}
          </p>
        </div>
      ) : (
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-foreground" />
            <span className="text-foreground text-sm">
              {isAr ? 'تفعيل الإشعارات' : 'Enable Notifications'}
            </span>
          </div>
          <button
            onClick={isSubscribed ? handleDisableNotifications : handleEnableNotifications}
            className={`w-11 h-6 rounded-full transition-all relative ${isSubscribed ? 'bg-primary' : 'bg-secondary'}`}
          >
            <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${isSubscribed ? 'left-6' : 'left-1'}`} />
          </button>
        </div>
      )}

      {/* Notification Type Preferences */}
      {isSubscribed && (
        <div className="space-y-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
            {isAr ? 'أنواع الإشعارات' : 'Notification Types'}
          </p>
          {NOTIFICATION_TYPES.map((type) => (
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
                onClick={() => handleTogglePreference(type.key)}
                className={`w-10 h-5 rounded-full transition-all relative flex-shrink-0 ml-2 ${
                  preferences[type.key] ? 'bg-primary' : 'bg-secondary'
                }`}
              >
                <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-[3px] transition-all ${
                  preferences[type.key] ? 'left-[22px]' : 'left-[3px]'
                }`} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Info text when not subscribed */}
      {!isSubscribed && permission !== 'denied' && (
        <p className="text-xs text-muted-foreground mt-2">
          {isAr
            ? 'فعّل الإشعارات لتلقي تذكيرات الصلاة، الفواتير، الأهداف، والمزيد.'
            : 'Enable notifications to receive prayer, bill, goal, and other important reminders.'}
        </p>
      )}
    </div>
  );
}