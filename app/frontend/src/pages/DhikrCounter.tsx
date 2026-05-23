import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import BottomNav from '@/components/BottomNav';
import PageHeader from '@/components/PageHeader';

interface DhikrPreset {
  id: string;
  arabic: string;
  transliteration: string;
  meaning: string;
  meaningAr: string;
  target: number;
}

const PRESETS: DhikrPreset[] = [
  { id: 'subhanallah', arabic: 'سُبْحَانَ اللَّهِ', transliteration: 'SubhanAllah', meaning: 'Glory be to Allah', meaningAr: 'تنزيه الله عن كل نقص', target: 33 },
  { id: 'alhamdulillah', arabic: 'الْحَمْدُ لِلَّهِ', transliteration: 'Alhamdulillah', meaning: 'All praise is due to Allah', meaningAr: 'الثناء على الله بصفات الكمال', target: 33 },
  { id: 'allahuakbar', arabic: 'اللَّهُ أَكْبَرُ', transliteration: 'Allahu Akbar', meaning: 'Allah is the Greatest', meaningAr: 'الله أعظم من كل شيء', target: 33 },
  { id: 'lailaha', arabic: 'لَا إِلَٰهَ إِلَّا اللَّهُ', transliteration: 'La ilaha illallah', meaning: 'There is no god but Allah', meaningAr: 'لا معبود بحق إلا الله', target: 100 },
  { id: 'astaghfirullah', arabic: 'أَسْتَغْفِرُ اللَّهَ', transliteration: 'Astaghfirullah', meaning: 'I seek forgiveness from Allah', meaningAr: 'أطلب المغفرة من الله', target: 100 },
  { id: 'salawat', arabic: 'اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ', transliteration: 'Allahumma salli ala Muhammad', meaning: 'O Allah, send blessings upon Muhammad', meaningAr: 'الصلاة على النبي ﷺ', target: 100 },
];

export default function DhikrCounter() {
  const { user, loading: authLoading } = useAuth();
  const { language, isRTL } = useLanguage();
  const navigate = useNavigate();
  const [selectedPreset, setSelectedPreset] = useState<DhikrPreset>(PRESETS[0]);
  const [count, setCount] = useState(0);
  const [dailyTotal, setDailyTotal] = useState(0);
  const [showPresets, setShowPresets] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate('/login');
  }, [user, authLoading, navigate]);

  // Load state from localStorage
  useEffect(() => {
    const today = new Date().toDateString();
    const savedCount = localStorage.getItem(`dhikr_count_${selectedPreset.id}_${today}`);
    const savedTotal = localStorage.getItem(`dhikr_total_${today}`);
    if (savedCount) setCount(parseInt(savedCount));
    else setCount(0);
    if (savedTotal) setDailyTotal(parseInt(savedTotal));
  }, [selectedPreset]);

  // Save state
  useEffect(() => {
    const today = new Date().toDateString();
    localStorage.setItem(`dhikr_count_${selectedPreset.id}_${today}`, count.toString());
    localStorage.setItem(`dhikr_total_${today}`, dailyTotal.toString());
  }, [count, dailyTotal, selectedPreset]);

  const increment = () => {
    setCount((c) => c + 1);
    setDailyTotal((t) => t + 1);
    // Haptic feedback if available
    if (navigator.vibrate) navigator.vibrate(10);
  };

  const reset = () => {
    setCount(0);
  };

  const progress = Math.min((count / selectedPreset.target) * 100, 100);
  const isComplete = count >= selectedPreset.target;

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-background pb-20" dir={isRTL ? 'rtl' : 'ltr'}>
      <PageHeader icon="🔢" title={language === 'ar' ? 'عداد الذكر' : 'Dhikr Counter'} />

      <main className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Daily Stats */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            {language === 'ar' ? 'إجمالي اليوم' : "Today's Total"}
          </p>
          <p className="text-2xl font-bold text-primary">{dailyTotal}</p>
        </div>

        {/* Selected Dhikr Display */}
        <Card className="border-0 shadow-lg text-center">
          <CardContent className="p-6">
            <p className="text-3xl font-arabic text-foreground mb-2">{selectedPreset.arabic}</p>
            <p className="text-sm font-medium text-foreground">{selectedPreset.transliteration}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {language === 'ar' ? selectedPreset.meaningAr : selectedPreset.meaning}
            </p>
          </CardContent>
        </Card>

        {/* Counter Display */}
        <div className="text-center space-y-4">
          {/* Progress Ring */}
          <div className="relative inline-flex items-center justify-center">
            <svg className="w-48 h-48 transform -rotate-90">
              <circle cx="96" cy="96" r="88" stroke="currentColor" className="text-secondary" strokeWidth="8" fill="none" />
              <circle
                cx="96"
                cy="96"
                r="88"
                stroke={isComplete ? '#22C55E' : '#1FC7C1'}
                strokeWidth="8"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 88}`}
                strokeDashoffset={`${2 * Math.PI * 88 * (1 - progress / 100)}`}
                strokeLinecap="round"
                className="transition-all duration-300"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-bold text-foreground">{count}</span>
              <span className="text-sm text-muted-foreground">/ {selectedPreset.target}</span>
            </div>
          </div>

          {/* Tap Button */}
          <button
            onClick={increment}
            className="w-32 h-32 rounded-full bg-gradient-to-br from-primary to-[#178F8A] text-white text-xl font-bold shadow-xl hover:shadow-2xl active:scale-95 transition-all mx-auto flex items-center justify-center"
          >
            {language === 'ar' ? 'اضغط' : 'TAP'}
          </button>

          {/* Controls */}
          <div className="flex gap-3 justify-center">
            <Button variant="outline" size="sm" onClick={reset}>
              {language === 'ar' ? 'إعادة' : 'Reset'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowPresets(!showPresets)}>
              {language === 'ar' ? 'تغيير الذكر' : 'Change Dhikr'}
            </Button>
          </div>
        </div>

        {/* Preset Selector */}
        {showPresets && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                {language === 'ar' ? 'اختر الذكر' : 'Select Dhikr'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  className={`w-full p-3 rounded-lg text-${isRTL ? 'right' : 'left'} transition-all ${
                    selectedPreset.id === preset.id
                      ? 'bg-primary/10 border-primary border'
                      : 'bg-secondary border border-border hover:bg-secondary/80'
                  }`}
                  onClick={() => {
                    setSelectedPreset(preset);
                    setShowPresets(false);
                    const today = new Date().toDateString();
                    const savedCount = localStorage.getItem(`dhikr_count_${preset.id}_${today}`);
                    setCount(savedCount ? parseInt(savedCount) : 0);
                  }}
                >
                  <p className="font-semibold text-sm text-foreground">
                    {language === 'ar' ? preset.arabic : preset.transliteration}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {language === 'ar' ? preset.meaningAr : preset.meaning} • {language === 'ar' ? 'الهدف' : 'Target'}: {preset.target}
                  </p>
                </button>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Completion Message */}
        {isComplete && (
          <div className="text-center p-4 rounded-xl bg-primary/10 border border-primary/30">
            <p className="text-primary font-semibold">
              {language === 'ar' ? '🎉 تم الوصول للهدف!' : '🎉 Target Reached!'}
            </p>
            <p className="text-sm text-primary/80 mt-1">
              {language === 'ar'
                ? 'ما شاء الله! أكملت هدف الذكر.'
                : "MashaAllah! You've completed your dhikr goal."}
            </p>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}