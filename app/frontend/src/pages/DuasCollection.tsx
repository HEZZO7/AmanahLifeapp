import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import BottomNav from '@/components/BottomNav';

interface Dua {
  id: string;
  category: string;
  arabic: string;
  transliteration: string;
  translation: string;
  reference: string;
}

const DUAS: Dua[] = [
  {
    id: '1',
    category: 'Morning',
    arabic: 'أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ',
    transliteration: "Asbahna wa asbahal mulku lillah, walhamdu lillah",
    translation: 'We have reached the morning and at this very time the whole kingdom belongs to Allah. All praise is due to Allah.',
    reference: 'Muslim',
  },
  {
    id: '2',
    category: 'Morning',
    arabic: 'اللَّهُمَّ بِكَ أَصْبَحْنَا وَبِكَ أَمْسَيْنَا وَبِكَ نَحْيَا وَبِكَ نَمُوتُ وَإِلَيْكَ النُّشُورُ',
    transliteration: "Allahumma bika asbahna wa bika amsayna wa bika nahya wa bika namutu wa ilaykan-nushur",
    translation: 'O Allah, by You we enter the morning and by You we enter the evening, by You we live and by You we die, and to You is the resurrection.',
    reference: 'Tirmidhi',
  },
  {
    id: '3',
    category: 'Evening',
    arabic: 'أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ',
    transliteration: "Amsayna wa amsal mulku lillah, walhamdu lillah",
    translation: 'We have reached the evening and at this very time the whole kingdom belongs to Allah. All praise is due to Allah.',
    reference: 'Muslim',
  },
  {
    id: '4',
    category: 'Before Sleep',
    arabic: 'بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا',
    transliteration: "Bismika Allahumma amutu wa ahya",
    translation: 'In Your name, O Allah, I die and I live.',
    reference: 'Bukhari',
  },
  {
    id: '5',
    category: 'Before Sleep',
    arabic: 'اللَّهُمَّ قِنِي عَذَابَكَ يَوْمَ تَبْعَثُ عِبَادَكَ',
    transliteration: "Allahumma qini adhabaka yawma tab'athu ibadak",
    translation: 'O Allah, protect me from Your punishment on the day You resurrect Your servants.',
    reference: 'Abu Dawud',
  },
  {
    id: '6',
    category: 'Eating',
    arabic: 'بِسْمِ اللَّهِ وَعَلَى بَرَكَةِ اللَّهِ',
    transliteration: "Bismillahi wa ala barakatillah",
    translation: 'In the name of Allah and with the blessings of Allah.',
    reference: 'Abu Dawud',
  },
  {
    id: '7',
    category: 'Eating',
    arabic: 'الْحَمْدُ لِلَّهِ الَّذِي أَطْعَمَنِي هَذَا وَرَزَقَنِيهِ مِنْ غَيْرِ حَوْلٍ مِنِّي وَلَا قُوَّةٍ',
    transliteration: "Alhamdu lillahil-ladhi at'amani hadha wa razaqanihi min ghayri hawlin minni wa la quwwah",
    translation: 'All praise is due to Allah who fed me this and provided it for me without any might or power from me.',
    reference: 'Tirmidhi',
  },
  {
    id: '8',
    category: 'Travel',
    arabic: 'سُبْحَانَ الَّذِي سَخَّرَ لَنَا هَذَا وَمَا كُنَّا لَهُ مُقْرِنِينَ',
    transliteration: "Subhanal-ladhi sakhkhara lana hadha wa ma kunna lahu muqrinin",
    translation: 'Glory be to Him who has subjected this to us, and we were not capable of that.',
    reference: 'Quran 43:13',
  },
  {
    id: '9',
    category: 'Protection',
    arabic: 'بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ وَهُوَ السَّمِيعُ الْعَلِيمُ',
    transliteration: "Bismillahil-ladhi la yadurru ma'asmihi shay'un fil-ardi wa la fis-sama'i wa huwas-Sami'ul-Alim",
    translation: 'In the name of Allah, with whose name nothing on earth or in heaven can cause harm, and He is the All-Hearing, the All-Knowing.',
    reference: 'Abu Dawud, Tirmidhi',
  },
  {
    id: '10',
    category: 'Protection',
    arabic: 'أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ',
    transliteration: "A'udhu bi kalimatillahit-tammati min sharri ma khalaq",
    translation: 'I seek refuge in the perfect words of Allah from the evil of what He has created.',
    reference: 'Muslim',
  },
  {
    id: '11',
    category: 'Anxiety',
    arabic: 'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْهَمِّ وَالْحَزَنِ',
    transliteration: "Allahumma inni a'udhu bika minal-hammi wal-hazan",
    translation: 'O Allah, I seek refuge in You from worry and grief.',
    reference: 'Bukhari',
  },
  {
    id: '12',
    category: 'Gratitude',
    arabic: 'اللَّهُمَّ أَعِنِّي عَلَى ذِكْرِكَ وَشُكْرِكَ وَحُسْنِ عِبَادَتِكَ',
    transliteration: "Allahumma a'inni ala dhikrika wa shukrika wa husni ibadatik",
    translation: 'O Allah, help me to remember You, to thank You, and to worship You well.',
    reference: 'Abu Dawud',
  },
];

const CATEGORIES = ['All', 'Morning', 'Evening', 'Before Sleep', 'Eating', 'Travel', 'Protection', 'Anxiety', 'Gratitude'];

export default function DuasCollection() {
  const { user, loading: authLoading } = useAuth();
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
      dua.category.toLowerCase().includes(search.toLowerCase());
    return matchCategory && matchSearch;
  });

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 pb-20">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 flex items-center justify-between h-14">
          <div className="w-16" />
          <h1 className="text-lg font-bold text-gray-900">🤲 Duas</h1>
          <div className="w-16" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* Search */}
        <Input
          placeholder="Search duas..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-white"
        />

        {/* Category Filter */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {CATEGORIES.map((cat) => (
            <Button
              key={cat}
              size="sm"
              variant={selectedCategory === cat ? 'default' : 'outline'}
              className={selectedCategory === cat ? 'bg-amber-600 hover:bg-amber-700 shrink-0' : 'shrink-0'}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </Button>
          ))}
        </div>

        {/* Favorites Section */}
        {selectedCategory === 'All' && favorites.size > 0 && (
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-amber-700 mb-2">⭐ Favorites</h3>
            <div className="space-y-3">
              {DUAS.filter((d) => favorites.has(d.id)).map((dua) => (
                <DuaCard key={`fav-${dua.id}`} dua={dua} isFavorite={true} onToggleFavorite={toggleFavorite} />
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
            />
          ))}
        </div>

        {filteredDuas.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p className="text-4xl mb-2">🔍</p>
            <p>No duas found for this search.</p>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}

function DuaCard({ dua, isFavorite, onToggleFavorite }: { dua: Dua; isFavorite: boolean; onToggleFavorite: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className={`border transition-all ${isFavorite ? 'border-amber-200 bg-amber-50/50' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700 font-medium">
            {dua.category}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggleFavorite(dua.id)}
            className={isFavorite ? 'text-amber-500' : 'text-gray-400'}
          >
            {isFavorite ? '★' : '☆'}
          </Button>
        </div>

        <p className="text-right text-xl leading-loose font-arabic text-gray-800 mb-3">
          {dua.arabic}
        </p>

        <button
          className="text-left w-full"
          onClick={() => setExpanded(!expanded)}
        >
          <p className="text-sm font-medium text-gray-700 italic">{dua.transliteration}</p>
          {expanded && (
            <>
              <p className="text-sm text-gray-600 mt-2">{dua.translation}</p>
              <p className="text-xs text-gray-400 mt-2">Reference: {dua.reference}</p>
            </>
          )}
          {!expanded && (
            <p className="text-xs text-gray-400 mt-1">Tap to see translation</p>
          )}
        </button>
      </CardContent>
    </Card>
  );
}