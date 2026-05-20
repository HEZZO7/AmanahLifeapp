import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import AppLogo from '@/components/AppLogo';

export default function Welcome() {
  const navigate = useNavigate();
  const { setLanguage, t } = useLanguage();
  const [selected, setSelected] = useState<'ar' | 'en' | null>(null);

  const handleContinue = () => {
    if (selected) {
      setLanguage(selected);
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-[#0a2e1f] flex flex-col items-center justify-center px-6">
      {/* Logo */}
      <div className="mb-8 flex flex-col items-center">
        <AppLogo className="w-28 h-28 mb-4 mx-auto" />
        <h1 className="text-3xl font-bold text-white mb-1">AmanahLife</h1>
        <p className="text-gray-400 text-sm">رفيقك الإسلامي | Your Islamic Companion</p>
      </div>

      {/* Language Selection */}
      <div className="w-full max-w-sm">
        <p className="text-center text-gray-300 mb-6 text-lg">{t('chooseLanguage')}</p>

        <div className="space-y-3">
          <button
            onClick={() => setSelected('ar')}
            className={`w-full p-4 rounded-2xl border-2 transition-all flex items-center justify-between ${
              selected === 'ar'
                ? 'border-[#d4a853] bg-[#0f3d2a]'
                : 'border-[#1a4d35] bg-[#0f3d2a] hover:border-[#14b8a6]'
            }`}
          >
            <span className="text-white text-lg font-arabic">العربية</span>
            <span className="text-2xl">🇸🇦</span>
          </button>

          <button
            onClick={() => setSelected('en')}
            className={`w-full p-4 rounded-2xl border-2 transition-all flex items-center justify-between ${
              selected === 'en'
                ? 'border-[#d4a853] bg-[#0f3d2a]'
                : 'border-[#1a4d35] bg-[#0f3d2a] hover:border-[#14b8a6]'
            }`}
          >
            <span className="text-white text-lg">English</span>
            <span className="text-2xl">🇬🇧</span>
          </button>
        </div>

        <button
          onClick={handleContinue}
          disabled={!selected}
          className={`w-full mt-8 p-4 rounded-2xl text-lg font-semibold transition-all ${
            selected
              ? 'bg-[#14b8a6] text-white hover:bg-[#0d9488] active:scale-95'
              : 'bg-[#1a4d35] text-gray-500 cursor-not-allowed'
          }`}
        >
          {t('continue')}
        </button>
      </div>
    </div>
  );
}