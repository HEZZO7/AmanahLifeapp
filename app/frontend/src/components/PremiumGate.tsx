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
    <div className="relative min-h-[60vh] flex items-center justify-center">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 rounded-2xl" />
      <div className="relative z-20 text-center px-6 py-10">
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[#1a4a3a] flex items-center justify-center">
          <svg className="w-10 h-10 text-[#c9a96e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-foreground mb-2">{featureName}</h3>
        <p className="text-muted-foreground text-sm mb-6">
          {language === 'ar'
            ? 'هذه الميزة متاحة للمشتركين في الباقة المميزة'
            : 'This feature is available for premium subscribers'}
        </p>
        <button
          onClick={() => navigate('/subscription')}
          className="bg-[#c9a96e] hover:bg-[#b8944f] text-white font-semibold px-8 py-3 rounded-xl transition-all"
        >
          {language === 'ar' ? 'ترقية الآن' : 'Upgrade Now'}
        </button>
      </div>
    </div>
  );
}