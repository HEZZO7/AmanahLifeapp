import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/contexts/LanguageContext';
import BottomNav from '@/components/BottomNav';

interface Dua {
  id: string;
  category: string;
  categoryAr: string;
  arabic: string;
  transliteration: string;
  translation: string;
  reference: string;
}

const DUAS: Dua[] = [
  {
    id: '1',
    category: 'Morning',
    categoryAr: 'الصباح',
    arabic: 'أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ',
    transliteration: "Asbahna wa asbahal mulku lillah, walhamdu lillah",
    translation: 'We have reached the morning and at this very time the whole kingdom belongs to Allah. All praise is due to Allah.',
    reference: 'Muslim',
  },
  {
    id: '2',
    category: 'Morning',
    categoryAr: 'الصباح',
    arabic: 'اللَّهُمَّ بِكَ أَصْبَحْنَا وَبِكَ أَمْسَيْنَا وَبِكَ نَحْيَا وَبِكَ نَمُوتُ وَإِلَيْكَ النُّشُورُ',
    transliteration: "Allahumma bika asbahna wa bika amsayna wa bika nahya wa bika namutu wa ilaykan-nushur",
    translation: 'O Allah, by You we enter the morning and by You we enter the evening, by You we live and by You we die, and to You is the resurrection.',
    reference: 'Tirmidhi',
  },
  {
    id: '3',
    category: 'Evening',
    categoryAr: 'المساء',
    arabic: 'أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ',
    transliteration: "Amsayna wa amsal mulku lillah, walhamdu lillah",
    translation: 'We have reached the evening and at this very time the whole kingdom belongs to Allah. All praise is due to Allah.',
    reference: 'Muslim',
  },
  {
    id: '4',
    category: 'Before Sleep',
    categoryAr: 'قبل النوم',
    arabic: 'بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا',
    transliteration: "Bismika Allahumma amutu wa ahya",
    translation: 'In Your name, O Allah, I die and I live.',
    reference: 'Bukhari',
  },
  {
    id: '5',
    category: 'Before Sleep',
    categoryAr: 'قبل النوم',
    arabic: 'اللَّهُمَّ قِنِي عَذَابَكَ يَوْمَ تَبْعَثُ عِبَادَكَ',
    transliteration: "Allahumma qini adhabaka yawma tab'athu ibadak",
    translation: 'O Allah, protect me from Your punishment on the day You resurrect Your servants.',
    reference: 'Abu Dawud',
  },
  {
    id: '6',
    category: 'Eating',
    categoryAr: 'الطعام',
    arabic: 'بِسْمِ اللَّهِ وَعَلَى بَرَكَةِ اللَّهِ',
    transliteration: "Bismillahi wa ala barakatillah",
    translation: 'In the name of Allah and with the blessings of Allah.',
    reference: 'Abu Dawud',
  },
  {
    id: '7',
    category: 'Eating',
    categoryAr: 'الطعام',
    arabic: 'الْحَمْدُ لِلَّهِ الَّذِي أَطْعَمَنِي هَذَا وَرَزَقَنِيهِ مِنْ غَيْرِ حَوْلٍ مِنِّي وَلَا قُوَّةٍ',
    transliteration: "Alhamdu lillahil-ladhi at'amani hadha wa razaqanihi min ghayri hawlin minni wa la quwwah",
    translation: 'All praise is due to Allah who fed me this and provided it for me without any might or power from me.',
    reference: 'Tirmidhi',
  },
  {
    id: '8',
    category: 'Travel',
    categoryAr: 'السفر',
    arabic: 'سُبْحَانَ الَّذِي سَخَّرَ لَنَا هَذَا وَمَا كُنَّا لَهُ مُقْرِنِينَ',
    transliteration: "Subhanal-ladhi sakhkhara lana hadha wa ma kunna lahu muqrinin",
    translation: 'Glory be to Him who has subjected this to us, and we were not capable of that.',
    reference: 'Quran 43:13',
  },
  {
    id: '9',
    category: 'Protection',
    categoryAr: 'الحماية',
    arabic: 'بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ وَهُوَ السَّمِيعُ الْعَلِيمُ',
    transliteration: "Bismillahil-ladhi la yadurru ma'asmihi shay'un fil-ardi wa la fis-sama'i wa huwas-Sami'ul-Alim",
    translation: 'In the name of Allah, with whose name nothing on earth or in heaven can cause harm, and He is the All-Hearing, the All-Knowing.',
    reference: 'Abu Dawud, Tirmidhi',
  },
  {
    id: '10',
    category: 'Protection',
    categoryAr: 'الحماية',
    arabic: 'أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ',
    transliteration: "A'udhu bi kalimatillahit-tammati min sharri ma khalaq",
    translation: 'I seek refuge in the perfect words of Allah from the evil of what He has created.',
    reference: 'Muslim',
  },
  {
    id: '11',
    category: 'Anxiety',
    categoryAr: 'القلق',
    arabic: 'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْهَمِّ وَالْحَزَنِ',
    transliteration: "Allahumma inni a'udhu bika minal-hammi wal-hazan",
    translation: 'O Allah, I seek refuge in You from worry and grief.',
    reference: 'Bukhari',
  },
  {
    id: '12',
    category: 'Gratitude',
    categoryAr: 'الشكر',
    arabic: 'اللَّهُمَّ أَعِنِّي عَلَى ذِكْرِكَ وَشُكْرِكَ وَحُسْنِ عِبَادَتِكَ',
    transliteration: "Allahumma a'inni ala dhikrika wa shukrika wa husni ibadatik",
    translation: 'O Allah, help me to remember You, to thank You, and to worship You well.',
    reference: 'Abu Dawud',
  },
];

interface CategoryItem {
  en: string;
  ar: string;
}

const CATEGORIES: CategoryItem[] = [
  { en: 'All', ar: 'الكل' },
  { en: 'Morning', ar: 'الصباح' },
  { en: 'Evening', ar: 'المساء' },
  { en: 'Before Sleep', ar: 'قبل النوم' },
  { en: 'Eating', ar: 'الطعام' },
  { en: 'Travel', ar: 'السفر' },
  { en: 'Protection', ar: 'الحماية' },
  { en: 'Anxiety', ar: 'القلق' },
  { en: 'Gratitude', ar: 'الشكر' },
];

export default function DuasCollection() {
  const { user, loading: authLoading } = useAuth();
  const { language, isRTL } = useLanguage();
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!authLoading && !user) navigate('/login');
  }, [user, authLoading, navigate]);

  // Load favorites
  useEffect(() => {
    const saved = localStorage.getItem('dua_favorites');
    if (saved) setFavorites(new Set(JSON.parse(saved)));
  }, []);

  // Save favorites
  useEffect(() => {
    localStorage.setItem('dua_favorites', JSON.stringify([...favorites]));
  }, [favorites]);

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredDuas = DUAS.filter((dua) => {
    const matchCategory = selectedCategory === 'All' || dua.category === selectedCategory;
    const matchSearch =
      search === '' ||
      dua.transliteration.toLowerCase().includes(search.toLowerCase()) ||
      dua.translation.toLowerCase().includes(search.toLowerCase()) ||
      dua.category.toLowerCase().includes(search.toLowerCase()) ||
      dua.categoryAr.includes(search) ||
      dua.arabic.includes(search);
    return matchCategory && matchSearch;
  });

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-background pb-20" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 flex items-center justify-between h-14">
          <div className="w-16" />
          <h1 className="text-lg font-bold text-foreground">
            🤲 {language === 'ar' ? 'الأدعية' : 'Duas'}
          </h1>
          <div className="w-16" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* Search */}
        <Input
          placeholder={language === 'ar' ? 'ابحث في الأدعية...' : 'Search duas...'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-card"
        />

        {/* Category Filter */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {CATEGORIES.map((cat) => (
            <Button
              key={cat.en}
              size="sm"
              variant={selectedCategory === cat.en ? 'default' : 'outline'}
              className={selectedCategory === cat.en ? 'bg-[#D4A017] hover:bg-[#C4890A] text-white shrink-0' : 'text-foreground shrink-0'}
              onClick={() => setSelectedCategory(cat.en)}
            >
              {language === 'ar' ? cat.ar : cat.en}
            </Button>
          ))}
        </div>

        {/* Favorites Section */}
        {selectedCategory === 'All' && favorites.size > 0 && (
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-[#D4A017] mb-2">
              ⭐ {language === 'ar' ? 'المفضلة' : 'Favorites'}
            </h3>
            <div className="space-y-3">
              {DUAS.filter((d) => favorites.has(d.id)).map((dua) => (
                <DuaCard key={`fav-${dua.id}`} dua={dua} isFavorite={true} onToggleFavorite={toggleFavorite} language={language} isRTL={isRTL} />
              ))}
            </div>
          </div>
        )}

        {/* Duas List */}
        <div className="space-y-3">
          {filteredDuas.map((dua) => (
            <DuaCard
              key={dua.id}
              dua={dua}
              isFavorite={favorites.has(dua.id)}
              onToggleFavorite={toggleFavorite}
              language={language}
              isRTL={isRTL}
            />
          ))}
        </div>

        {filteredDuas.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-4xl mb-2">🔍</p>
            <p>{language === 'ar' ? 'لم يتم العثور على أدعية.' : 'No duas found for this search.'}</p>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}

function DuaCard({ dua, isFavorite, onToggleFavorite, language, isRTL }: { dua: Dua; isFavorite: boolean; onToggleFavorite: (id: string) => void; language: string; isRTL: boolean }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className={`border transition-all ${isFavorite ? 'border-[#D4A017]/50 bg-[#D4A017]/5' : 'border-border'}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <span className="text-xs px-2 py-1 rounded-full bg-[#D4A017]/10 text-[#D4A017] font-medium">
            {language === 'ar' ? dua.categoryAr : dua.category}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggleFavorite(dua.id)}
            className={isFavorite ? 'text-[#D4A017]' : 'text-muted-foreground'}
          >
            {isFavorite ? '★' : '☆'}
          </Button>
        </div>

        <p className="text-right text-xl leading-loose font-arabic text-foreground mb-3">
          {dua.arabic}
        </p>

        <button
          className={`text-${isRTL ? 'right' : 'left'} w-full`}
          onClick={() => setExpanded(!expanded)}
        >
          <p className="text-sm font-medium text-muted-foreground italic">{dua.transliteration}</p>
          {expanded && (
            <>
              <p className="text-sm text-foreground/80 mt-2">{dua.translation}</p>
              <p className="text-xs text-muted-foreground mt-2">
                {language === 'ar' ? 'المرجع' : 'Reference'}: {dua.reference}
              </p>
            </>
          )}
          {!expanded && (
            <p className="text-xs text-muted-foreground mt-1">
              {language === 'ar' ? 'اضغط لعرض الترجمة' : 'Tap to see translation'}
            </p>
          )}
        </button>
      </CardContent>
    </Card>
  );
}