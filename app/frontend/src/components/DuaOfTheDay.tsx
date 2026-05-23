import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const NOTIFICATION_KEY = 'amanah-dua-notifications';

const duas = [
  { arabic: 'رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ', transliteration: 'Rabbana atina fid-dunya hasanatan wa fil-akhirati hasanatan waqina adhaban-nar', english: 'Our Lord, give us good in this world and good in the Hereafter, and protect us from the torment of the Fire.' },
  { arabic: 'رَبِّ اشْرَحْ لِي صَدْرِي وَيَسِّرْ لِي أَمْرِي', transliteration: 'Rabbi-shrah li sadri wa yassir li amri', english: 'My Lord, expand for me my chest and ease for me my task.' },
  { arabic: 'رَبِّ زِدْنِي عِلْمًا', transliteration: 'Rabbi zidni ilma', english: 'My Lord, increase me in knowledge.' },
  { arabic: 'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْهَمِّ وَالْحَزَنِ', transliteration: 'Allahumma inni a\'udhu bika minal-hammi wal-hazan', english: 'O Allah, I seek refuge in You from worry and grief.' },
  { arabic: 'حَسْبِيَ اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ عَلَيْهِ تَوَكَّلْتُ', transliteration: 'Hasbiyallahu la ilaha illa Huwa, alayhi tawakkaltu', english: 'Sufficient for me is Allah; there is no deity except Him. On Him I have relied.' },
  { arabic: 'اللَّهُمَّ اهْدِنِي وَسَدِّدْنِي', transliteration: 'Allahumma-hdini wa saddidni', english: 'O Allah, guide me and keep me on the right path.' },
  { arabic: 'رَبَّنَا لَا تُزِغْ قُلُوبَنَا بَعْدَ إِذْ هَدَيْتَنَا', transliteration: 'Rabbana la tuzigh quloobana ba\'da idh hadaytana', english: 'Our Lord, let not our hearts deviate after You have guided us.' },
  { arabic: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَافِيَةَ فِي الدُّنْيَا وَالْآخِرَةِ', transliteration: 'Allahumma inni as\'alukal-\'afiyah fid-dunya wal-akhirah', english: 'O Allah, I ask You for well-being in this world and the Hereafter.' },
  { arabic: 'رَبِّ أَوْزِعْنِي أَنْ أَشْكُرَ نِعْمَتَكَ', transliteration: 'Rabbi awzi\'ni an ashkura ni\'mataka', english: 'My Lord, enable me to be grateful for Your favor.' },
  { arabic: 'اللَّهُمَّ أَصْلِحْ لِي دِينِي الَّذِي هُوَ عِصْمَةُ أَمْرِي', transliteration: 'Allahumma aslih li dini alladhi huwa \'ismatu amri', english: 'O Allah, set right my religion which is the safeguard of my affairs.' },
  { arabic: 'اللَّهُمَّ اغْفِرْ لِي وَارْحَمْنِي وَاهْدِنِي وَارْزُقْنِي', transliteration: 'Allahumma-ghfir li warhamni wahdini warzuqni', english: 'O Allah, forgive me, have mercy on me, guide me, and provide for me.' },
  { arabic: 'رَبَّنَا هَبْ لَنَا مِنْ أَزْوَاجِنَا وَذُرِّيَّاتِنَا قُرَّةَ أَعْيُنٍ', transliteration: 'Rabbana hab lana min azwajina wa dhurriyyatina qurrata a\'yun', english: 'Our Lord, grant us from among our spouses and offspring comfort to our eyes.' },
  { arabic: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ الْهُدَى وَالتُّقَى وَالْعَفَافَ وَالْغِنَى', transliteration: 'Allahumma inni as\'alukal-huda wat-tuqa wal-\'afafa wal-ghina', english: 'O Allah, I ask You for guidance, piety, chastity, and self-sufficiency.' },
  { arabic: 'رَبِّ اجْعَلْنِي مُقِيمَ الصَّلَاةِ وَمِن ذُرِّيَّتِي', transliteration: 'Rabbij-\'alni muqimas-salati wa min dhurriyyati', english: 'My Lord, make me an establisher of prayer, and from my descendants.' },
  { arabic: 'اللَّهُمَّ بَارِكْ لَنَا فِي رِزْقِنَا', transliteration: 'Allahumma barik lana fi rizqina', english: 'O Allah, bless us in our provision.' },
  { arabic: 'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنْ عِلْمٍ لَا يَنْفَعُ', transliteration: 'Allahumma inni a\'udhu bika min \'ilmin la yanfa\'', english: 'O Allah, I seek refuge in You from knowledge that does not benefit.' },
  { arabic: 'رَبَّنَا تَقَبَّلْ مِنَّا إِنَّكَ أَنتَ السَّمِيعُ الْعَلِيمُ', transliteration: 'Rabbana taqabbal minna innaka antas-Sami\'ul-\'Alim', english: 'Our Lord, accept from us. Indeed You are the Hearing, the Knowing.' },
  { arabic: 'اللَّهُمَّ أَعِنِّي عَلَى ذِكْرِكَ وَشُكْرِكَ وَحُسْنِ عِبَادَتِكَ', transliteration: 'Allahumma a\'inni \'ala dhikrika wa shukrika wa husni \'ibadatik', english: 'O Allah, help me to remember You, thank You, and worship You well.' },
  { arabic: 'رَبَّنَا اغْفِرْ لَنَا ذُنُوبَنَا وَإِسْرَافَنَا فِي أَمْرِنَا', transliteration: 'Rabbana-ghfir lana dhunubana wa israfana fi amrina', english: 'Our Lord, forgive us our sins and our excesses in our affairs.' },
  { arabic: 'اللَّهُمَّ اجْعَلْ فِي قَلْبِي نُورًا', transliteration: 'Allahummaj-\'al fi qalbi nura', english: 'O Allah, place light in my heart.' },
  { arabic: 'رَبِّ لَا تَذَرْنِي فَرْدًا وَأَنتَ خَيْرُ الْوَارِثِينَ', transliteration: 'Rabbi la tadhrani fardan wa anta khayrul-warithin', english: 'My Lord, do not leave me alone, and You are the best of inheritors.' },
  { arabic: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ خَيْرَ هَذَا الْيَوْمِ', transliteration: 'Allahumma inni as\'aluka khayra hadhal-yawm', english: 'O Allah, I ask You for the good of this day.' },
  { arabic: 'اللَّهُمَّ اكْفِنِي بِحَلَالِكَ عَنْ حَرَامِكَ', transliteration: 'Allahummak-fini bi halalika \'an haramik', english: 'O Allah, suffice me with what You have made lawful over what You have made unlawful.' },
  { arabic: 'رَبَّنَا آمَنَّا فَاغْفِرْ لَنَا وَارْحَمْنَا وَأَنتَ خَيْرُ الرَّاحِمِينَ', transliteration: 'Rabbana amanna faghfir lana warhamna wa anta khayrur-rahimin', english: 'Our Lord, we have believed, so forgive us and have mercy upon us, and You are the best of the merciful.' },
  { arabic: 'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْكَسَلِ وَالْهَرَمِ', transliteration: 'Allahumma inni a\'udhu bika minal-kasali wal-haram', english: 'O Allah, I seek refuge in You from laziness and old age.' },
  { arabic: 'رَبِّ هَبْ لِي حُكْمًا وَأَلْحِقْنِي بِالصَّالِحِينَ', transliteration: 'Rabbi hab li hukman wa alhiqni bis-salihin', english: 'My Lord, grant me authority and join me with the righteous.' },
  { arabic: 'اللَّهُمَّ ثَبِّتْنِي وَاجْعَلْنِي هَادِيًا مَهْدِيًّا', transliteration: 'Allahumma thabbitni waj\'alni hadiyan mahdiyya', english: 'O Allah, make me steadfast and make me a guide who is rightly guided.' },
  { arabic: 'رَبَّنَا أَفْرِغْ عَلَيْنَا صَبْرًا وَتَوَفَّنَا مُسْلِمِينَ', transliteration: 'Rabbana afrigh \'alayna sabran wa tawaffana muslimin', english: 'Our Lord, pour upon us patience and let us die as Muslims.' },
  { arabic: 'اللَّهُمَّ يَا مُقَلِّبَ الْقُلُوبِ ثَبِّتْ قَلْبِي عَلَى دِينِكَ', transliteration: 'Allahumma ya muqallibal-qulub thabbit qalbi \'ala dinik', english: 'O Allah, Turner of hearts, keep my heart firm upon Your religion.' },
  { arabic: 'رَبِّ أَدْخِلْنِي مُدْخَلَ صِدْقٍ وَأَخْرِجْنِي مُخْرَجَ صِدْقٍ', transliteration: 'Rabbi adkhilni mudkhala sidqin wa akhrijni mukhraja sidq', english: 'My Lord, cause me to enter a sound entrance and cause me to exit a sound exit.' },
  { arabic: 'اللَّهُمَّ اجْعَلْنِي شَكُورًا لَكَ ذَكَّارًا لَكَ', transliteration: 'Allahummaj-\'alni shakuran laka dhakkaran lak', english: 'O Allah, make me grateful to You, always remembering You.' },
];

export default function DuaOfTheDay() {
  const { language } = useLanguage();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(NOTIFICATION_KEY);
    if (saved === 'true') setNotificationsEnabled(true);
  }, []);

  // Get today's dua based on day of year
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const todaysDua = duas[dayOfYear % duas.length];

  const requestNotifications = async () => {
    if (!('Notification' in window)) return;
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setNotificationsEnabled(true);
        localStorage.setItem(NOTIFICATION_KEY, 'true');
        setShowConfirmation(true);
        setTimeout(() => setShowConfirmation(false), 3000);
      }
    } catch {
      // Permission denied or error
    }
  };

  return (
    <Card className="mb-6 p-5 bg-gradient-to-br from-card via-card to-primary/5 border-border overflow-hidden relative">
      {/* Decorative element */}
      <div className="absolute top-0 right-0 w-20 h-20 bg-[#D4A017]/5 rounded-full -translate-y-1/2 translate-x-1/2" />
      
      <div className="relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">🤲</span>
            <h3 className="text-sm font-semibold text-[#D4A017]">
              {language === 'ar' ? 'دعاء اليوم' : 'Dua of the Day'}
            </h3>
          </div>
          <span className="text-[10px] text-muted-foreground bg-background/50 px-2 py-0.5 rounded-full">
            #{(dayOfYear % duas.length) + 1}/{duas.length}
          </span>
        </div>

        {/* Arabic Text */}
        <p className="text-lg font-arabic text-foreground leading-relaxed text-center mb-3" dir="rtl">
          {todaysDua.arabic}
        </p>

        {/* Transliteration */}
        <p className="text-xs text-primary/80 italic text-center mb-2">
          {todaysDua.transliteration}
        </p>

        {/* English Translation */}
        <p className="text-sm text-muted-foreground text-center mb-4">
          {todaysDua.english}
        </p>

        {/* Notification Button */}
        {!notificationsEnabled ? (
          <Button
            size="sm"
            variant="outline"
            className="w-full text-xs border-[#D4A017]/30 text-[#D4A017] hover:bg-[#D4A017]/10"
            onClick={requestNotifications}
          >
            🔔 {language === 'ar' ? 'تفعيل التذكير اليومي' : 'Enable Daily Reminders'}
          </Button>
        ) : (
          <div className="text-center">
            <span className="text-xs text-primary bg-primary/10 px-3 py-1 rounded-full">
              ✓ {language === 'ar' ? 'التذكيرات مفعلة' : 'Reminders enabled'}
            </span>
          </div>
        )}

        {/* Confirmation Toast */}
        {showConfirmation && (
          <div className="absolute bottom-0 left-0 right-0 bg-primary/20 border border-primary/30 rounded-lg p-2 text-center animate-in fade-in">
            <p className="text-xs text-primary">
              ✓ {language === 'ar' ? 'تم تفعيل التذكيرات بنجاح!' : 'Daily reminders enabled successfully!'}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}