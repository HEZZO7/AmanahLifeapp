import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import BottomNav from '@/components/BottomNav';

interface Dhikr {
  id: string;
  arabic: string;
  transliteration: string;
  translation: string;
  count: number;
}

interface AdhkarCategory {
  id: string;
  nameAr: string;
  nameEn: string;
  icon: string;
  items: Dhikr[];
}

const ADHKAR_DATA: AdhkarCategory[] = [
  {
    id: 'morning',
    nameAr: 'أذكار الصباح',
    nameEn: 'Morning Adhkar',
    icon: '🌅',
    items: [
      { id: 'm1', arabic: 'أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ', transliteration: "Asbahna wa asbahal mulku lillah", translation: "We have reached the morning and at this very time the kingdom belongs to Allah", count: 1 },
      { id: 'm2', arabic: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ', transliteration: "SubhanAllahi wa bihamdihi", translation: "Glory is to Allah and praise is to Him", count: 33 },
      { id: 'm3', arabic: 'لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ', transliteration: "La ilaha illAllahu wahdahu la sharika lah", translation: "None has the right to be worshipped except Allah alone", count: 3 },
      { id: 'm4', arabic: 'أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ', transliteration: "A'udhu bikalimatillahit-tammati min sharri ma khalaq", translation: "I seek refuge in the perfect words of Allah from the evil of what He has created", count: 3 },
      { id: 'm5', arabic: 'بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ', transliteration: "Bismillahil-ladhi la yadurru ma'asmihi shay'un", translation: "In the name of Allah with whose name nothing can harm", count: 3 },
      { id: 'm6', arabic: 'اللَّهُمَّ بِكَ أَصْبَحْنَا وَبِكَ أَمْسَيْنَا', transliteration: "Allahumma bika asbahna wa bika amsayna", translation: "O Allah, by Your leave we have reached the morning", count: 1 },
      { id: 'm7', arabic: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ', transliteration: "Allahumma inni as'alukal-'afwa wal-'afiyah", translation: "O Allah, I ask You for pardon and well-being", count: 3 },
      { id: 'm8', arabic: 'حَسْبِيَ اللَّهُ لَا إِلَهَ إِلَّا هُوَ', transliteration: "HasbiyAllahu la ilaha illa Huwa", translation: "Allah is sufficient for me, there is no god but He", count: 7 },
    ],
  },
  {
    id: 'evening',
    nameAr: 'أذكار المساء',
    nameEn: 'Evening Adhkar',
    icon: '🌙',
    items: [
      { id: 'e1', arabic: 'أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ', transliteration: "Amsayna wa amsal mulku lillah", translation: "We have reached the evening and the kingdom belongs to Allah", count: 1 },
      { id: 'e2', arabic: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ', transliteration: "SubhanAllahi wa bihamdihi", translation: "Glory is to Allah and praise is to Him", count: 33 },
      { id: 'e3', arabic: 'أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ', transliteration: "A'udhu bikalimatillahit-tammati min sharri ma khalaq", translation: "I seek refuge in the perfect words of Allah from the evil of what He has created", count: 3 },
      { id: 'e4', arabic: 'اللَّهُمَّ بِكَ أَمْسَيْنَا وَبِكَ أَصْبَحْنَا', transliteration: "Allahumma bika amsayna wa bika asbahna", translation: "O Allah, by Your leave we have reached the evening", count: 1 },
      { id: 'e5', arabic: 'اللَّهُمَّ مَا أَمْسَى بِي مِنْ نِعْمَةٍ فَمِنْكَ', transliteration: "Allahumma ma amsa bi min ni'matin faminka", translation: "O Allah, whatever blessing has been received by me is from You", count: 1 },
      { id: 'e6', arabic: 'لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ', transliteration: "La ilaha illAllahu wahdahu la sharika lah", translation: "None has the right to be worshipped except Allah alone", count: 3 },
    ],
  },
  {
    id: 'afterPrayer',
    nameAr: 'أذكار بعد الصلاة',
    nameEn: 'After Prayer',
    icon: '🕌',
    items: [
      { id: 'p1', arabic: 'أَسْتَغْفِرُ اللَّهَ', transliteration: "Astaghfirullah", translation: "I seek forgiveness from Allah", count: 3 },
      { id: 'p2', arabic: 'سُبْحَانَ اللَّهِ', transliteration: "SubhanAllah", translation: "Glory be to Allah", count: 33 },
      { id: 'p3', arabic: 'الْحَمْدُ لِلَّهِ', transliteration: "Alhamdulillah", translation: "All praise is due to Allah", count: 33 },
      { id: 'p4', arabic: 'اللَّهُ أَكْبَرُ', transliteration: "Allahu Akbar", translation: "Allah is the Greatest", count: 33 },
      { id: 'p5', arabic: 'لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ', transliteration: "La ilaha illAllahu wahdahu la sharika lah", translation: "None has the right to be worshipped except Allah alone", count: 1 },
    ],
  },
  {
    id: 'sleep',
    nameAr: 'أذكار النوم',
    nameEn: 'Sleep Adhkar',
    icon: '😴',
    items: [
      { id: 's1', arabic: 'بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا', transliteration: "Bismika Allahumma amutu wa ahya", translation: "In Your name O Allah, I die and I live", count: 1 },
      { id: 's2', arabic: 'سُبْحَانَ اللَّهِ', transliteration: "SubhanAllah", translation: "Glory be to Allah", count: 33 },
      { id: 's3', arabic: 'الْحَمْدُ لِلَّهِ', transliteration: "Alhamdulillah", translation: "All praise is due to Allah", count: 33 },
      { id: 's4', arabic: 'اللَّهُ أَكْبَرُ', transliteration: "Allahu Akbar", translation: "Allah is the Greatest", count: 34 },
      { id: 's5', arabic: 'اللَّهُمَّ قِنِي عَذَابَكَ يَوْمَ تَبْعَثُ عِبَادَكَ', transliteration: "Allahumma qini 'adhabaka yawma tab'athu 'ibadak", translation: "O Allah, protect me from Your punishment on the day You resurrect Your servants", count: 3 },
    ],
  },
];

export default function Adhkar() {
  const { language, t } = useLanguage();
  const [selectedCategory, setSelectedCategory] = useState<string>('morning');
  const [progress, setProgress] = useState<Record<string, number>>({});

  const today = new Date().toDateString();

  useEffect(() => {
    const stored = localStorage.getItem(`adhkar_progress_${today}`);
    if (stored) setProgress(JSON.parse(stored));
  }, [today]);

  const saveProgress = (updated: Record<string, number>) => {
    setProgress(updated);
    localStorage.setItem(`adhkar_progress_${today}`, JSON.stringify(updated));
  };

  const increment = (id: string, maxCount: number) => {
    const current = progress[id] || 0;
    if (current < maxCount) {
      const updated = { ...progress, [id]: current + 1 };
      saveProgress(updated);
    }
  };

  const currentCategory = ADHKAR_DATA.find((c) => c.id === selectedCategory)!;
  const totalRequired = currentCategory.items.reduce((sum, item) => sum + item.count, 0);
  const totalDone = currentCategory.items.reduce((sum, item) => sum + Math.min(progress[item.id] || 0, item.count), 0);

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-4">
        <h1 className="text-xl font-bold text-foreground">{t('adhkar')}</h1>
        <p className="text-muted-foreground text-sm mt-0.5">{totalDone}/{totalRequired} {t('completed')}</p>
      </header>

      {/* Category Tabs */}
      <div className="px-4 py-3 flex gap-2 overflow-x-auto scrollbar-hide">
        {ADHKAR_DATA.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm transition-all ${
              selectedCategory === cat.id
                ? 'bg-primary text-white'
                : 'bg-card text-muted-foreground hover:bg-secondary'
            }`}
          >
            {cat.icon} {language === 'ar' ? cat.nameAr : cat.nameEn}
          </button>
        ))}
      </div>

      {/* Overall Progress */}
      <div className="px-4 py-2">
        <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-[#d4a853] rounded-full transition-all duration-300"
            style={{ width: `${totalRequired > 0 ? (totalDone / totalRequired) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Adhkar Items */}
      <div className="px-4 py-2 space-y-3">
        {currentCategory.items.map((item) => {
          const current = progress[item.id] || 0;
          const isDone = current >= item.count;
          return (
            <div
              key={item.id}
              className={`p-4 rounded-2xl border transition-all ${
                isDone
                  ? 'bg-primary/10 border-primary/30'
                  : 'bg-card border-border'
              }`}
            >
              <p className="text-foreground font-arabic text-lg leading-relaxed mb-2 text-right">{item.arabic}</p>
              <p className="text-muted-foreground text-xs italic mb-1">{item.transliteration}</p>
              <p className="text-muted-foreground text-xs mb-3">{item.translation}</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${(current / item.count) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">{current}/{item.count}</span>
                </div>
                <button
                  onClick={() => increment(item.id, item.count)}
                  disabled={isDone}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    isDone
                      ? 'bg-primary/20 text-primary'
                      : 'bg-primary text-white active:scale-90'
                  }`}
                >
                  {isDone ? '✓' : '+1'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <BottomNav />
    </div>
  );
}