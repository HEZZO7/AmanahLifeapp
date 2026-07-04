import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

interface Quote {
  arabic: string;
  english: string;
  source: string;
  sourceAr: string;
  type: 'islamic' | 'motivational';
}

const QUOTES: Quote[] = [
  // Islamic wisdom
  { arabic: 'إِنَّ مَعَ الْعُسْرِ يُسْرًا', english: 'Indeed, with hardship comes ease.', source: 'Quran 94:6', sourceAr: 'القرآن ٩٤:٦', type: 'islamic' },
  { arabic: 'وَمَن يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ', english: 'Whoever relies upon Allah – then He is sufficient for him.', source: 'Quran 65:3', sourceAr: 'القرآن ٦٥:٣', type: 'islamic' },
  { arabic: 'فَاذْكُرُونِي أَذْكُرْكُمْ', english: 'So remember Me; I will remember you.', source: 'Quran 2:152', sourceAr: 'القرآن ٢:١٥٢', type: 'islamic' },
  { arabic: 'وَلَسَوْفَ يُعْطِيكَ رَبُّكَ فَتَرْضَىٰ', english: 'And your Lord is going to give you, and you will be satisfied.', source: 'Quran 93:5', sourceAr: 'القرآن ٩٣:٥', type: 'islamic' },
  { arabic: 'إِنَّ اللَّهَ لَا يُضِيعُ أَجْرَ الْمُحْسِنِينَ', english: 'Indeed, Allah does not allow to be lost the reward of those who do good.', source: 'Quran 9:120', sourceAr: 'القرآن ٩:١٢٠', type: 'islamic' },
  { arabic: 'خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ', english: 'The best among you are those who learn the Quran and teach it.', source: 'Sahih al-Bukhari', sourceAr: 'صحيح البخاري', type: 'islamic' },
  { arabic: 'إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ', english: 'Actions are judged by intentions.', source: 'Sahih al-Bukhari & Muslim', sourceAr: 'متفق عليه', type: 'islamic' },
  { arabic: 'مَنْ سَلَكَ طَرِيقًا يَلْتَمِسُ فِيهِ عِلْمًا سَهَّلَ اللَّهُ لَهُ طَرِيقًا إِلَى الْجَنَّةِ', english: 'Whoever takes a path seeking knowledge, Allah will ease for him a path to Paradise.', source: 'Sahih Muslim', sourceAr: 'صحيح مسلم', type: 'islamic' },
  { arabic: 'الْمُؤْمِنُ الْقَوِيُّ خَيْرٌ وَأَحَبُّ إِلَى اللَّهِ مِنَ الْمُؤْمِنِ الضَّعِيفِ', english: 'The strong believer is better and more beloved to Allah than the weak believer.', source: 'Sahih Muslim', sourceAr: 'صحيح مسلم', type: 'islamic' },
  { arabic: 'لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا', english: 'Allah does not burden a soul beyond that it can bear.', source: 'Quran 2:286', sourceAr: 'القرآن ٢:٢٨٦', type: 'islamic' },
  // Motivational / productivity
  { arabic: 'النجاح ليس نهائيًا، والفشل ليس قاتلًا: إنها الشجاعة للاستمرار هي ما يهم.', english: 'Success is not final, failure is not fatal: it is the courage to continue that counts.', source: 'Winston Churchill', sourceAr: 'ونستون تشرشل', type: 'motivational' },
  { arabic: 'الطريقة الوحيدة للقيام بعمل عظيم هي أن تحب ما تفعله.', english: 'The only way to do great work is to love what you do.', source: 'Steve Jobs', sourceAr: 'ستيف جوبز', type: 'motivational' },
  { arabic: 'لا تنتظر الفرصة، بل اصنعها.', english: "Don't wait for opportunity. Create it.", source: 'George Bernard Shaw', sourceAr: 'جورج برنارد شو', type: 'motivational' },
  { arabic: 'كل يوم هو فرصة جديدة لتغيير حياتك.', english: 'Every day is a new opportunity to change your life.', source: 'Unknown', sourceAr: 'مجهول', type: 'motivational' },
  { arabic: 'الانضباط هو الجسر بين الأهداف والإنجاز.', english: 'Discipline is the bridge between goals and accomplishment.', source: 'Jim Rohn', sourceAr: 'جيم رون', type: 'motivational' },
  { arabic: 'ابدأ من حيث أنت. استخدم ما لديك. افعل ما تستطيع.', english: 'Start where you are. Use what you have. Do what you can.', source: 'Arthur Ashe', sourceAr: 'آرثر آش', type: 'motivational' },
  { arabic: 'الاتساق أهم من الكمال.', english: 'Consistency is more important than perfection.', source: 'Unknown', sourceAr: 'مجهول', type: 'motivational' },
  { arabic: 'خطط ليومك وإلا سيخطط لك أحد آخر.', english: "Plan your day or someone else will plan it for you.", source: 'Jim Rohn', sourceAr: 'جيم رون', type: 'motivational' },
  { arabic: 'التقدم الصغير كل يوم يؤدي إلى نتائج كبيرة.', english: 'Small daily progress leads to big results.', source: 'Unknown', sourceAr: 'مجهول', type: 'motivational' },
  { arabic: 'أنت لا تحتاج أن تكون عظيمًا لتبدأ، لكنك تحتاج أن تبدأ لتكون عظيمًا.', english: "You don't have to be great to start, but you have to start to be great.", source: 'Zig Ziglar', sourceAr: 'زيج زيجلار', type: 'motivational' },
];

function getDailyQuote(): Quote {
  const today = new Date();
  const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000);
  return QUOTES[dayOfYear % QUOTES.length];
}

export default function MotivationalQuote() {
  const { language } = useLanguage();
  const [quote, setQuote] = useState<Quote>(getDailyQuote);
  const isAr = language === 'ar';

  useEffect(() => {
    setQuote(getDailyQuote());
  }, []);

  return (
    <div className="mb-4 bg-card/60 backdrop-blur-sm rounded-2xl border border-border/60 p-4 relative overflow-hidden">
      {/* Subtle decorative element */}
      <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-[#D4A017]/10 to-transparent rounded-bl-full" />
      
      <div className="flex items-start gap-2 mb-2">
        <span className="text-sm">✨</span>
        <p className="text-[10px] uppercase tracking-wider text-[#D4A017] font-medium">
          {isAr ? 'إلهام اليوم' : 'Daily Inspiration'}
        </p>
      </div>
      
      <p className={`text-foreground text-sm leading-relaxed mb-2 ${isAr ? 'font-arabic' : ''}`}>
        {isAr ? `"${quote.arabic}"` : `"${quote.english}"`}
      </p>
      
      {/* Show translation in smaller text */}
      <p className="text-muted-foreground text-xs italic mb-1.5">
        {isAr ? quote.english : quote.arabic}
      </p>
      
      <p className="text-[10px] text-[#D4A017]/80">
        — {isAr ? quote.sourceAr : quote.source}
      </p>
    </div>
  );
}