import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import BottomNav from '@/components/BottomNav';

interface Surah {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: string;
}

interface PageAyah {
  number: number;
  text: string;
  numberInSurah: number;
  translation?: string;
  surah: { number: number; name: string; englishName: string };
}

interface Boundary {
  surah: number;
  ayah: number;
}

const TOTAL_PAGES = 604;

// api.alquran.cloud prepends the Basmalah to the text of ayah 1 for every
// surah except Al-Fatihah (1) and At-Tawbah (9, which has no Basmalah at all).
// The Basmalah is not part of the ayah itself (Al-Fatihah is the sole
// exception per the Madinah Mushaf/Hafs convention), and the app already
// renders it as a separate header above the surah, so it must be stripped
// here to avoid it being duplicated/glued onto ayah 1's text.
const BASMALAH_VARIANTS = [
  'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
  'بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ',
];

function stripBasmalahPrefix(text: string, surahNumber: number, numberInSurah: number): string {
  if (surahNumber === 1 || numberInSurah !== 1) return text;
  for (const b of BASMALAH_VARIANTS) {
    if (text.startsWith(b)) {
      return text.slice(b.length).trim();
    }
  }
  return text;
}

function findPageForBoundary(pages: Boundary[], target: Boundary): number {
  let page = 1;
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    if (p.surah < target.surah || (p.surah === target.surah && p.ayah <= target.ayah)) {
      page = i + 1;
    } else {
      break;
    }
  }
  return page;
}

export default function QuranReader() {
  const { user, loading: authLoading } = useAuth();
  const { language, isRTL } = useLanguage();
  const navigate = useNavigate();

  // Index view state
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [pageBoundaries, setPageBoundaries] = useState<Boundary[]>([]);
  const [juzBoundaries, setJuzBoundaries] = useState<Boundary[]>([]);
  const [metaLoading, setMetaLoading] = useState(true);
  const [indexTab, setIndexTab] = useState<'surah' | 'juz'>('surah');
  const [search, setSearch] = useState('');

  // Reader view state
  const [view, setView] = useState<'index' | 'reader'>('index');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageAyahs, setPageAyahs] = useState<PageAyah[]>([]);
  const [readerLoading, setReaderLoading] = useState(false);
  const [pageJumpInput, setPageJumpInput] = useState('');

  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());

  const todayKey = new Date().toDateString();
  const [quranPages, setQuranPages] = useState<number>(() => {
    const stored = localStorage.getItem(`quran_pages_${todayKey}`);
    return stored ? parseInt(stored, 10) : 0;
  });

  const [nightMode, setNightMode] = useState(() => localStorage.getItem('quran_night_mode') === '1');
  const [keepAwake, setKeepAwake] = useState(() => localStorage.getItem('quran_keep_awake') === '1');
  const [hideAyat, setHideAyat] = useState(() => localStorage.getItem('quran_hide_ayat') === '1');
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const addPages = (n: number) => {
    const newVal = Math.max(0, quranPages + n);
    setQuranPages(newVal);
    localStorage.setItem(`quran_pages_${todayKey}`, String(newVal));
  };

  useEffect(() => {
    if (!authLoading && !user) navigate('/login');
  }, [user, authLoading, navigate]);

  // Load bookmarks
  useEffect(() => {
    const saved = localStorage.getItem('quran_bookmarks');
    if (saved) setBookmarks(new Set(JSON.parse(saved)));
  }, []);

  useEffect(() => {
    localStorage.setItem('quran_bookmarks', JSON.stringify([...bookmarks]));
  }, [bookmarks]);

  // Fetch surah list + page/juz boundary metadata (needed to jump to the right Mushaf page)
  useEffect(() => {
    const loadMeta = async () => {
      try {
        const [surahRes, metaRes] = await Promise.all([
          fetch('https://api.alquran.cloud/v1/surah'),
          fetch('https://api.alquran.cloud/v1/meta'),
        ]);
        const surahData = await surahRes.json();
        const metaData = await metaRes.json();
        setSurahs(surahData.data);
        setPageBoundaries(metaData.data.pages.references);
        setJuzBoundaries(metaData.data.juzs.references);
      } catch {
        toast.error(language === 'ar' ? 'فشل تحميل بيانات القرآن' : 'Failed to load Quran data');
      } finally {
        setMetaLoading(false);
      }
    };
    loadMeta();
  }, [language]);

  const openPage = async (pageNumber: number) => {
    const clamped = Math.min(Math.max(1, pageNumber), TOTAL_PAGES);
    setReaderLoading(true);
    setView('reader');
    setCurrentPage(clamped);
    setRevealed(new Set());
    try {
      const [arabicRes, translationRes] = await Promise.all([
        fetch(`https://api.alquran.cloud/v1/page/${clamped}/quran-uthmani`),
        fetch(`https://api.alquran.cloud/v1/page/${clamped}/en.sahih`),
      ]);
      const arabicData = await arabicRes.json();
      const translationData = await translationRes.json();
      const combined: PageAyah[] = arabicData.data.ayahs.map((ayah: PageAyah, i: number) => ({
        ...ayah,
        text: stripBasmalahPrefix(ayah.text, ayah.surah.number, ayah.numberInSurah),
        translation: translationData.data.ayahs[i]?.text || '',
      }));
      setPageAyahs(combined);
      const first = combined[0];
      if (first) {
        localStorage.setItem(
          'quran_last_read',
          JSON.stringify({ page: clamped, surah: first.surah.number, name: first.surah.englishName })
        );
      }
    } catch {
      toast.error(language === 'ar' ? 'فشل تحميل الصفحة' : 'Failed to load page');
    } finally {
      setReaderLoading(false);
    }
  };

  const openSurah = (surah: Surah) => {
    const page = findPageForBoundary(pageBoundaries, { surah: surah.number, ayah: 1 });
    openPage(page);
  };

  const openJuz = (juzNumber: number) => {
    const boundary = juzBoundaries[juzNumber - 1];
    if (!boundary) return;
    const page = findPageForBoundary(pageBoundaries, boundary);
    openPage(page);
  };

  const handlePageJump = () => {
    const n = parseInt(pageJumpInput, 10);
    if (!n || n < 1 || n > TOTAL_PAGES) {
      toast.error(language === 'ar' ? `أدخل رقم صفحة بين 1 و ${TOTAL_PAGES}` : `Enter a page number between 1 and ${TOTAL_PAGES}`);
      return;
    }
    setPageJumpInput('');
    openPage(n);
  };

  const toggleBookmark = (key: string) => {
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleReveal = (key: string) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleNightMode = () => {
    setNightMode((prev) => {
      const next = !prev;
      localStorage.setItem('quran_night_mode', next ? '1' : '0');
      return next;
    });
  };

  const toggleHideAyat = () => {
    setHideAyat((prev) => {
      const next = !prev;
      localStorage.setItem('quran_hide_ayat', next ? '1' : '0');
      setRevealed(new Set());
      return next;
    });
  };

  const toggleKeepAwake = async () => {
    if (!('wakeLock' in navigator)) {
      toast.error(language === 'ar' ? 'غير مدعوم في هذا المتصفح' : 'Not supported in this browser');
      return;
    }
    if (keepAwake) {
      await wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
      setKeepAwake(false);
      localStorage.setItem('quran_keep_awake', '0');
    } else {
      try {
        wakeLockRef.current = await (navigator as Navigator & {
          wakeLock: { request: (type: 'screen') => Promise<WakeLockSentinel> };
        }).wakeLock.request('screen');
        setKeepAwake(true);
        localStorage.setItem('quran_keep_awake', '1');
      } catch {
        toast.error(language === 'ar' ? 'تعذّر تفعيل بقاء الشاشة مضاءة' : 'Could not keep screen awake');
      }
    }
  };

  useEffect(() => {
    return () => {
      wakeLockRef.current?.release().catch(() => {});
    };
  }, []);

  const lastRead = (() => {
    const raw = localStorage.getItem('quran_last_read');
    return raw ? JSON.parse(raw) : null;
  })();

  const filteredSurahs = surahs.filter(
    (s) =>
      s.englishName.toLowerCase().includes(search.toLowerCase()) ||
      s.englishNameTranslation.toLowerCase().includes(search.toLowerCase()) ||
      s.name.includes(search) ||
      s.number.toString() === search
  );

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-background pb-20" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center h-16 gap-3">
          <button
            onClick={() => (view === 'reader' ? setView('index') : navigate(-1))}
            className="w-9 h-9 rounded-full bg-card flex items-center justify-center border border-border"
          >
            <svg className="w-5 h-5 text-foreground rtl:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-foreground">
            📖{' '}
            {view === 'reader'
              ? (language === 'ar' ? `صفحة ${currentPage}` : `Page ${currentPage}`)
              : (language === 'ar' ? 'القرآن الكريم' : 'Quran')}
          </h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {view === 'index' ? (
          <>
            {/* Index tabs */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setIndexTab('surah')}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                  indexTab === 'surah' ? 'bg-primary text-white' : 'bg-card text-muted-foreground border border-border'
                }`}
              >
                {language === 'ar' ? 'السور' : 'Surahs'}
              </button>
              <button
                onClick={() => setIndexTab('juz')}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                  indexTab === 'juz' ? 'bg-primary text-white' : 'bg-card text-muted-foreground border border-border'
                }`}
              >
                {language === 'ar' ? 'الأجزاء' : 'Juz'}
              </button>
            </div>

            {/* Quick page jump */}
            <Card className="mb-4 border-border">
              <CardContent className="p-4 flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={TOTAL_PAGES}
                  placeholder={language === 'ar' ? `رقم الصفحة (1-${TOTAL_PAGES})` : `Page number (1-${TOTAL_PAGES})`}
                  value={pageJumpInput}
                  onChange={(e) => setPageJumpInput(e.target.value)}
                  className="bg-background"
                />
                <Button onClick={handlePageJump} className="bg-primary hover:bg-primary/90 shrink-0">
                  {language === 'ar' ? 'اذهب' : 'Go'}
                </Button>
              </CardContent>
            </Card>

            {/* Last Read */}
            {lastRead && (
              <Card className="mb-4 border-primary/30 bg-primary/5">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-primary font-medium">
                      {language === 'ar' ? 'متابعة القراءة' : 'Continue Reading'}
                    </p>
                    <p className="font-semibold text-foreground">{lastRead.name}</p>
                  </div>
                  <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={() => openPage(lastRead.page)}>
                    {language === 'ar' ? 'استئناف' : 'Resume'}
                  </Button>
                </CardContent>
              </Card>
            )}

            {indexTab === 'surah' ? (
              <>
                <div className="mb-4">
                  <Input
                    placeholder={language === 'ar' ? 'ابحث عن سورة بالاسم أو الرقم...' : 'Search surah by name or number...'}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="bg-card"
                  />
                </div>
                {metaLoading ? (
                  <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredSurahs.map((surah) => (
                      <Card
                        key={surah.number}
                        className="cursor-pointer hover:shadow-md transition-all border border-border"
                        onClick={() => openSurah(surah)}
                      >
                        <CardContent className="p-4 flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                            {surah.number}
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-foreground">
                              {language === 'ar' ? surah.name : surah.englishName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {language === 'ar'
                                ? `${surah.numberOfAyahs} آيات • ${surah.revelationType === 'Meccan' ? 'مكية' : 'مدنية'}`
                                : `${surah.englishNameTranslation} • ${surah.numberOfAyahs} ayahs • ${surah.revelationType}`}
                            </p>
                          </div>
                          <p className="text-lg font-arabic text-foreground">
                            {language === 'ar' ? surah.englishName : surah.name}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-2">
                {metaLoading ? (
                  <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  juzBoundaries.map((boundary, i) => {
                    const juzNumber = i + 1;
                    const startSurah = surahs.find((s) => s.number === boundary.surah);
                    return (
                      <Card
                        key={juzNumber}
                        className="cursor-pointer hover:shadow-md transition-all border border-border"
                        onClick={() => openJuz(juzNumber)}
                      >
                        <CardContent className="p-4 flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                            {juzNumber}
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-foreground">
                              {language === 'ar' ? `الجزء ${juzNumber}` : `Juz ${juzNumber}`}
                            </p>
                            {startSurah && (
                              <p className="text-xs text-muted-foreground">
                                {language === 'ar'
                                  ? `يبدأ من ${startSurah.name} ${boundary.ayah}`
                                  : `Starts at ${startSurah.englishName} ${boundary.ayah}`}
                              </p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            )}

            {/* Pages Read Today */}
            <Card className="mt-4 border-border">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold text-[#D4A017]">{quranPages}</p>
                  <p className="text-xs text-muted-foreground">
                    {language === 'ar' ? 'صفحات اليوم • الهدف: 20 صفحة' : "Today's pages • Goal: 20 pages"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => addPages(-1)}
                    className="w-10 h-10 rounded-full bg-secondary text-foreground flex items-center justify-center hover:bg-primary/20"
                  >
                    -
                  </button>
                  <button
                    onClick={() => addPages(1)}
                    className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center hover:bg-[#178F8A]"
                  >
                    +
                  </button>
                  <button
                    onClick={() => addPages(5)}
                    className="w-10 h-10 rounded-full bg-[#D4A017] text-white flex items-center justify-center hover:bg-[#C4890A]"
                  >
                    +5
                  </button>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            {/* Reader toolbar */}
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                onClick={() => openPage(currentPage - 1)}
                disabled={currentPage <= 1}
                className="px-3 py-2 rounded-lg bg-card border border-border text-sm text-foreground disabled:opacity-40"
              >
                {isRTL ? '→' : '←'} {language === 'ar' ? 'السابقة' : 'Prev'}
              </button>
              <button
                onClick={() => openPage(currentPage + 1)}
                disabled={currentPage >= TOTAL_PAGES}
                className="px-3 py-2 rounded-lg bg-card border border-border text-sm text-foreground disabled:opacity-40"
              >
                {language === 'ar' ? 'التالية' : 'Next'} {isRTL ? '←' : '→'}
              </button>
              <button
                onClick={toggleNightMode}
                className={`px-3 py-2 rounded-lg text-sm border ${nightMode ? 'bg-primary text-white border-primary' : 'bg-card text-foreground border-border'}`}
              >
                {nightMode ? '☀️' : '🌙'} {language === 'ar' ? 'القراءة الليلية' : 'Night mode'}
              </button>
              <button
                onClick={toggleKeepAwake}
                className={`px-3 py-2 rounded-lg text-sm border ${keepAwake ? 'bg-primary text-white border-primary' : 'bg-card text-foreground border-border'}`}
              >
                📱 {language === 'ar' ? 'إبقاء الشاشة مضاءة' : 'Keep awake'}
              </button>
              <button
                onClick={toggleHideAyat}
                className={`px-3 py-2 rounded-lg text-sm border ${hideAyat ? 'bg-primary text-white border-primary' : 'bg-card text-foreground border-border'}`}
              >
                🙈 {language === 'ar' ? 'إخفاء الآيات' : 'Hide ayat'}
              </button>
              <div className="flex items-center gap-2 ml-auto">
                <button onClick={() => addPages(-1)} className="w-8 h-8 rounded-full bg-secondary text-foreground text-sm">
                  -
                </button>
                <span className="text-sm text-muted-foreground">
                  {language === 'ar' ? `${quranPages} صفحة اليوم` : `${quranPages} today`}
                </span>
                <button onClick={() => addPages(1)} className="w-8 h-8 rounded-full bg-primary text-white text-sm">
                  +
                </button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center mb-4">
              {language === 'ar' ? 'الترجمة الإنجليزية: صحيح إنترناشونال (Saheeh International)' : 'Translation: Saheeh International'}
            </p>

            {readerLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div
                className={`space-y-4 rounded-2xl p-2 ${nightMode ? 'bg-[#161613]' : ''}`}
              >
                {pageAyahs.map((ayah, idx) => {
                  const key = `${ayah.surah.number}:${ayah.numberInSurah}`;
                  const isBookmarked = bookmarks.has(key);
                  const isNewSurah = idx === 0 || pageAyahs[idx - 1].surah.number !== ayah.surah.number;
                  const isRevealed = !hideAyat || revealed.has(key);
                  return (
                    <div key={ayah.number}>
                      {isNewSurah && (
                        <div className="text-center py-3">
                          <p className={`font-bold ${nightMode ? 'text-[#e8d9b0]' : 'text-foreground'}`}>
                            {language === 'ar' ? ayah.surah.name : ayah.surah.englishName}
                          </p>
                          {ayah.surah.number !== 1 && ayah.surah.number !== 9 && ayah.numberInSurah === 1 && (
                            <p className={`text-xl font-arabic mt-2 ${nightMode ? 'text-[#e8d9b0]' : 'text-foreground'}`}>
                              بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                            </p>
                          )}
                        </div>
                      )}
                      <Card
                        className={`border ${isBookmarked ? 'border-[#D4A017] bg-[#D4A017]/5' : nightMode ? 'border-transparent bg-transparent shadow-none' : 'border-border'}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                              {ayah.numberInSurah}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleBookmark(key)}
                              className={isBookmarked ? 'text-[#D4A017]' : 'text-muted-foreground'}
                            >
                              {isBookmarked ? '★' : '☆'}
                            </Button>
                          </div>
                          {isRevealed ? (
                            <>
                              <p className={`text-right text-xl leading-loose font-arabic mb-3 ${nightMode ? 'text-[#e8d9b0]' : 'text-foreground'}`}>
                                {ayah.text}
                              </p>
                              <p className={`text-sm leading-relaxed ${nightMode ? 'text-[#c9bb95]' : 'text-muted-foreground'}`}>
                                {ayah.translation}
                              </p>
                            </>
                          ) : (
                            <button
                              onClick={() => toggleReveal(key)}
                              className={`w-full py-6 rounded-xl border border-dashed text-sm ${nightMode ? 'border-[#e8d9b0]/30 text-[#e8d9b0]/70' : 'border-border text-muted-foreground'}`}
                            >
                              {language === 'ar' ? 'اضغط للكشف عن الآية' : 'Tap to reveal ayah'}
                            </button>
                          )}
                        </CardContent>
                      </Card>
                    </div>
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
