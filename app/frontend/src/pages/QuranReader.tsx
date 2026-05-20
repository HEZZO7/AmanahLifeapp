import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import BottomNav from '@/components/BottomNav';

interface Surah {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: string;
}

interface Ayah {
  number: number;
  text: string;
  numberInSurah: number;
  translation?: string;
}

export default function QuranReader() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [selectedSurah, setSelectedSurah] = useState<Surah | null>(null);
  const [ayahs, setAyahs] = useState<Ayah[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!authLoading && !user) navigate('/login');
  }, [user, authLoading, navigate]);

  // Load bookmarks from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('quran_bookmarks');
    if (saved) setBookmarks(new Set(JSON.parse(saved)));
  }, []);

  // Save bookmarks
  useEffect(() => {
    localStorage.setItem('quran_bookmarks', JSON.stringify([...bookmarks]));
  }, [bookmarks]);

  // Fetch surah list
  useEffect(() => {
    const fetchSurahs = async () => {
      try {
        const res = await fetch('https://api.alquran.cloud/v1/surah');
        const data = await res.json();
        setSurahs(data.data);
      } catch {
        toast.error('Failed to load Quran data');
      } finally {
        setLoading(false);
      }
    };
    fetchSurahs();
  }, []);

  const loadSurah = async (surah: Surah) => {
    setLoading(true);
    setSelectedSurah(surah);
    try {
      const [arabicRes, englishRes] = await Promise.all([
        fetch(`https://api.alquran.cloud/v1/surah/${surah.number}`),
        fetch(`https://api.alquran.cloud/v1/surah/${surah.number}/en.asad`),
      ]);
      const arabicData = await arabicRes.json();
      const englishData = await englishRes.json();

      const combined: Ayah[] = arabicData.data.ayahs.map((ayah: Ayah, i: number) => ({
        ...ayah,
        translation: englishData.data.ayahs[i]?.text || '',
      }));
      setAyahs(combined);
    } catch {
      toast.error('Failed to load surah');
    } finally {
      setLoading(false);
    }
  };

  const toggleBookmark = (key: string) => {
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Save last read position
  useEffect(() => {
    if (selectedSurah) {
      localStorage.setItem('quran_last_read', JSON.stringify({ surah: selectedSurah.number, name: selectedSurah.englishName }));
    }
  }, [selectedSurah]);

  const filteredSurahs = surahs.filter(
    (s) =>
      s.englishName.toLowerCase().includes(search.toLowerCase()) ||
      s.englishNameTranslation.toLowerCase().includes(search.toLowerCase()) ||
      s.number.toString() === search
  );

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50 pb-20">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 flex items-center justify-between h-14">
          {selectedSurah ? (
            <Button variant="ghost" size="sm" onClick={() => { setSelectedSurah(null); setAyahs([]); }}>
              ← Surahs
            </Button>
          ) : (
            <div className="w-16" />
          )}
          <h1 className="text-lg font-bold text-foreground">
            📖 {selectedSurah ? selectedSurah.englishName : 'Quran'}
          </h1>
          <div className="w-16" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {!selectedSurah ? (
          <>
            {/* Search */}
            <div className="mb-4">
              <Input
                placeholder="Search surah by name or number..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-white"
              />
            </div>

            {/* Last Read */}
            {localStorage.getItem('quran_last_read') && (
              <Card className="mb-4 border-purple-200 bg-purple-50">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-purple-600 font-medium">Continue Reading</p>
                    <p className="font-semibold text-foreground">
                      {JSON.parse(localStorage.getItem('quran_last_read') || '{}').name}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="bg-purple-600 hover:bg-purple-700"
                    onClick={() => {
                      const last = JSON.parse(localStorage.getItem('quran_last_read') || '{}');
                      const surah = surahs.find((s) => s.number === last.surah);
                      if (surah) loadSurah(surah);
                    }}
                  >
                    Resume
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Surah List */}
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredSurahs.map((surah) => (
                  <Card
                    key={surah.number}
                    className="cursor-pointer hover:shadow-md transition-all border"
                    onClick={() => loadSurah(surah)}
                  >
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-sm font-bold text-purple-700">
                        {surah.number}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-foreground">{surah.englishName}</p>
                        <p className="text-xs text-muted-foreground">
                          {surah.englishNameTranslation} • {surah.numberOfAyahs} ayahs • {surah.revelationType}
                        </p>
                      </div>
                      <p className="text-lg font-arabic text-foreground">{surah.name}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {/* Ayah List */}
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Bismillah */}
                {selectedSurah.number !== 1 && selectedSurah.number !== 9 && (
                  <p className="text-center text-2xl font-arabic text-foreground py-4">
                    بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                  </p>
                )}
                {ayahs.map((ayah) => {
                  const key = `${selectedSurah.number}:${ayah.numberInSurah}`;
                  const isBookmarked = bookmarks.has(key);
                  return (
                    <Card key={ayah.number} className={`border ${isBookmarked ? 'border-amber-300 bg-amber-50' : ''}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <span className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-xs font-bold text-purple-700">
                            {ayah.numberInSurah}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleBookmark(key)}
                            className={isBookmarked ? 'text-amber-500' : 'text-gray-400'}
                          >
                            {isBookmarked ? '★' : '☆'}
                          </Button>
                        </div>
                        <p className="text-right text-xl leading-loose font-arabic text-foreground mb-3">
                          {ayah.text}
                        </p>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {ayah.translation}
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
}