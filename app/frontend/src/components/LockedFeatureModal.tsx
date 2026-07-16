import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface LockedFeatureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Which plan unlocks this feature — shown in the message. */
  requiredPlan: 'balanced' | 'family';
}

const PLAN_NAMES: Record<'balanced' | 'family', { en: string; ar: string }> = {
  balanced: { en: 'Balanced Life', ar: 'الحياة المتوازنة' },
  family: { en: 'Family Plan', ar: 'أمانة العائلة' },
};

export default function LockedFeatureModal({ open, onOpenChange, requiredPlan }: LockedFeatureModalProps) {
  const { language, isRTL } = useLanguage();
  const isAr = language === 'ar';
  const navigate = useNavigate();
  const planName = PLAN_NAMES[requiredPlan];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className={isRTL ? 'text-right' : 'text-left'}>
            {isAr ? '🔒 ميزة مدفوعة' : '🔒 Premium Feature'}
          </DialogTitle>
          <DialogDescription className={isRTL ? 'text-right' : 'text-left'}>
            {isAr
              ? `هذه الميزة متاحة في خطة ${planName.ar}. قم بالترقية للوصول إليها.`
              : `This feature is available in the ${planName.en} plan. Upgrade to unlock it.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            className="w-full bg-primary text-primary-foreground"
            onClick={() => {
              onOpenChange(false);
              navigate('/subscription');
            }}
          >
            {isAr ? 'عرض خطط الاشتراك' : 'View Subscription Plans'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
