import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSubscription } from '@/contexts/SubscriptionContext';

const TIER_LEVELS: Record<string, number> = {
  free: 0,
  balanced: 1,
  family: 2,
};

interface PremiumGateProps {
  requiredTier: 'balanced' | 'family';
  featureName: string;
  children: ReactNode;
}

export default function PremiumGate({ requiredTier, featureName, children }: PremiumGateProps) {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { tier, loading } = useSubscription();

  const userLevel = TIER_LEVELS[tier] || 0;
  const requiredLevel = TIER_LEVELS[requiredTier] || 1;

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-[#c9a96e] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (userLevel >= requiredLevel) {
    return <>{children}</>;
  }

  return (
    <div className="relative min-h-[60vh] overflow-hidden rounded-2xl">
      {/* Blurred content preview */}
      <div className="pointer-events-none select-none blur-[6px] opacity-50 scale-[0.98]">
        {children}
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/40 backdrop-blur-[2px]">
        <div className="text-center px-6 py-8 max-w-sm">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#c9a96e]/20 to-[#1a4a3a]/40 flex items-center justify-center">
            <span className="text-3xl">✨</span>
          </div>
          <h3 className="text-lg font-bold text-foreground mb-2">{featureName}</h3>
          <p className="text-muted-foreground text-sm mb-5">
            {language === 'ar'
              ? 'هذه الميزة متاحة للمشتركين في الباقة المميزة. ابدأ تجربة مجانية لمدة 7 أيام!'
              : 'This feature is available for premium subscribers. Start a free 7-day trial!'}
          </p>
          <button
            onClick={() => navigate('/subscription')}
            className="bg-[#c9a96e] hover:bg-[#b8944f] text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-lg shadow-[#c9a96e]/20"
          >
            {language === 'ar' ? '✨ فتح مع المميز' : '✨ Unlock with Premium'}
          </button>
        </div>
      </div>
    </div>
  );
}