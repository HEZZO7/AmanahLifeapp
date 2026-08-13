import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import BottomNav from '@/components/BottomNav';
import PageHeader from '@/components/PageHeader';

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

// Ported verbatim from RN's app/(tabs)/adhkar.tsx (amanahlife-rn), the
// verified source after this session's Stage 4 content-completeness audit
// (commit 7dcf0bd) and Priority 5 IslamWeb cross-reference pass (commit
// 50709b6) - both cross-referenced against Hisn al-Muslim, IslamWeb, and
// sunnah.com. Web's own array (24 items) had no equivalent audit trail and
// diverged from a one-time copy of an earlier, shorter RN version - not
// re-derived here, ported directly per that investigation's conclusion.
const ADHKAR_DATA: AdhkarCategory[] = [
  {
    id: 'morning',
    nameAr: 'أذكار الصباح',
    nameEn: 'Morning Adhkar',
    icon: '🌅',
    items: [
      { id: 'm1', arabic: 'أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ وَالْحَمْدُ لِلَّهِ، لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ، رَبِّ أَسْأَلُكَ خَيْرَ مَا فِي هَذَا الْيَوْمِ وَخَيْرَ مَا بَعْدَهُ، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِي هَذَا الْيَوْمِ وَشَرِّ مَا بَعْدَهُ، رَبِّ أَعُوذُ بِكَ مِنَ الْكَسَلِ وَسُوءِ الْكِبَرِ، رَبِّ أَعُوذُ بِكَ مِنْ عَذَابٍ فِي النَّارِ وَعَذَابٍ فِي الْقَبْرِ', transliteration: "Asbahna wa asbahal-mulku lillahi wal-hamdu lillah, la ilaha illallahu wahdahu la sharika lah, lahul-mulku wa lahul-hamdu wa huwa 'ala kulli shay'in qadir, Rabbi as'aluka khayra ma fi hadha al-yawmi wa khayra ma ba'dahu, wa a'udhu bika min sharri ma fi hadha al-yawmi wa sharri ma ba'dahu, Rabbi a'udhu bika minal-kasali wa su'il-kibar, Rabbi a'udhu bika min 'adhabin fin-nari wa 'adhabin fil-qabr", translation: "We have reached the morning and with it all dominion belongs to Allah, and praise is to Allah. None has the right to be worshipped except Allah alone, He has no partner. His is the dominion and His is the praise, and He is over all things omnipotent. My Lord, I ask You for the good of this day and the good of what follows it, and I seek refuge in You from the evil of this day and the evil of what follows it. My Lord, I seek refuge in You from laziness and helpless old age. My Lord, I seek refuge in You from the punishment of the Fire and the punishment of the grave", count: 1 },
      { id: 'm2', arabic: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ', transliteration: "SubhanAllahi wa bihamdihi", translation: "Glory is to Allah and praise is to Him", count: 100 },
      { id: 'm3', arabic: 'لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ', transliteration: "La ilaha illAllahu wahdahu la sharika lah, lahul-mulku wa lahul-hamdu wa huwa 'ala kulli shay'in qadir", translation: "None has the right to be worshipped except Allah alone, He has no partner. His is the dominion and His is the praise, and He is over all things omnipotent", count: 10 },
      { id: 'm5', arabic: 'بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ وَهُوَ السَّمِيعُ الْعَلِيمُ', transliteration: "Bismillahil-ladhi la yadurru ma'a-smihi shay'un fil-ardi wa la fis-sama'i wa huwas-Sami'ul-'Alim", translation: "In the name of Allah, with whose name nothing can cause harm on earth nor in the heaven, and He is the All-Hearing, the All-Knowing", count: 3 },
      { id: 'm6', arabic: 'اللَّهُمَّ بِكَ أَصْبَحْنَا، وَبِكَ أَمْسَيْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ وَإِلَيْكَ النُّشُورُ', transliteration: "Allahumma bika asbahna, wa bika amsayna, wa bika nahya, wa bika namutu wa ilaykan-nushur", translation: "O Allah, by You we have reached the morning, and by You we have reached the evening, by You we live and by You we die, and to You is the resurrection", count: 1 },
      { id: 'm7', arabic: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ', transliteration: "Allahumma inni as'alukal-'afwa wal-'afiyah", translation: "O Allah, I ask You for pardon and well-being", count: 1 },
      { id: 'm8', arabic: 'حَسْبِيَ اللَّهُ لَا إِلَهَ إِلَّا هُوَ', transliteration: "HasbiyAllahu la ilaha illa Huwa", translation: "Allah is sufficient for me, there is no god but He", count: 7 },
      { id: 'm9', arabic: 'اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَٰهَ إِلَّا أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَى عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ، أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ، أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ، وَأَبُوءُ بِذَنْبِي فَاغْفِرْ لِي فَإِنَّهُ لَا يَغْفِرُ الذُّنُوبَ إِلَّا أَنْتَ', transliteration: "Allahumma anta Rabbi la ilaha illa anta, khalaqtani wa ana 'abduka, wa ana 'ala 'ahdika wa wa'dika mas-tata't, a'udhu bika min sharri ma sana't, abu'u laka bini'matika 'alayya, wa abu'u bidhanbi faghfir li fa-innahu la yaghfirudh-dhunuba illa ant", translation: "O Allah, You are my Lord, none has the right to be worshipped except You. You created me and I am Your servant, and I abide by Your covenant and promise as best I can. I seek refuge in You from the evil of what I have done. I acknowledge Your favor upon me, and I acknowledge my sin, so forgive me, for none forgives sins except You (Sayyid al-Istighfar)", count: 1 },
      { id: 'm10', arabic: 'اللَّهُمَّ إِنِّي أَصْبَحْتُ أُشْهِدُكَ وَأُشْهِدُ حَمَلَةَ عَرْشِكَ، وَمَلاَئِكَتِكَ، وَجَمِيعَ خَلْقِكَ، أَنَّكَ أَنْتَ اللَّهُ لَا إِلَٰهَ إِلَّا أَنْتَ وَحْدَكَ لَا شَرِيكَ لَكَ، وَأَنَّ مُحَمَّدًا عَبْدُكَ وَرَسُولُكَ', transliteration: "Allahumma inni asbahtu ush-hiduka wa ush-hidu hamalata 'arshika, wa mala'ikatika, wa jami'a khalqika, annaka antallahu la ilaha illa anta wahdaka la sharika laka, wa anna Muhammadan 'abduka wa rasuluk", translation: "O Allah, I have reached the morning and call on You, on the bearers of Your Throne, on Your angels and all creation to witness that You are Allah, none has the right to be worshipped except You alone, You have no partner, and that Muhammad is Your servant and Messenger", count: 4 },
      { id: 'm11', arabic: 'اللَّهُمَّ مَا أَصْبَحَ بِي مِنْ نِعْمَةٍ أَوْ بِأَحَدٍ مِنْ خَلْقِكَ فَمِنْكَ وَحْدَكَ لَا شَرِيكَ لَكَ، فَلَكَ الْحَمْدُ وَلَكَ الشُّكْرُ', transliteration: "Allahumma ma asbaha bi min ni'matin aw bi-ahadin min khalqika faminka wahdaka la sharika laka, falakal-hamdu wa lakash-shukr", translation: "O Allah, whatever blessing I or any of Your creation have risen upon is from You alone, without partner, so for You is all praise and unto You all thanks", count: 1 },
      { id: 'm12', arabic: 'اللَّهُمَّ عَافِنِي فِي بَدَنِي، اللَّهُمَّ عَافِنِي فِي سَمْعِي، اللَّهُمَّ عَافِنِي فِي بَصَرِي، لَا إِلَٰهَ إِلَّا أَنْتَ. اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْكُفْرِ وَالْفَقْرِ، وَأَعُوذُ بِكَ مِنْ عَذَابِ الْقَبْرِ، لَا إِلَٰهَ إِلَّا أَنْتَ', transliteration: "Allahumma 'afini fi badani, Allahumma 'afini fi sam'i, Allahumma 'afini fi basari, la ilaha illa ant. Allahumma inni a'udhu bika minal-kufri wal-faqr, wa a'udhu bika min 'adhabil-qabr, la ilaha illa ant", translation: "O Allah, grant my body health, O Allah, grant my hearing health, O Allah, grant my sight health, none has the right to be worshipped except You. O Allah, I seek refuge in You from disbelief and poverty, and from the punishment of the grave, none has the right to be worshipped except You", count: 3 },
      { id: 'm13', arabic: 'اللَّهُمَّ عَالِمَ الْغَيْبِ وَالشَّهَادَةِ فَاطِرَ السَّمَاوَاتِ وَالْأَرْضِ، رَبَّ كُلِّ شَيْءٍ وَمَلِيكَهُ، أَشْهَدُ أَنْ لَا إِلَٰهَ إِلَّا أَنْتَ، أَعُوذُ بِكَ مِنْ شَرِّ نَفْسِي، وَمِنْ شَرِّ الشَّيْطَانِ وَشِرْكِهِ، وَأَنْ أَقْتَرِفَ عَلَى نَفْسِي سُوءًا أَوْ أَجُرَّهُ إِلَى مُسْلِمٍ', transliteration: "Allahumma 'Alimal-ghaybi wash-shahadah, Fatiras-samawati wal-ard, Rabba kulli shay'in wa malikahu, ash-hadu al-la ilaha illa ant, a'udhu bika min sharri nafsi, wa min sharrish-shaytani wa shirkihi, wa an aqtarifa 'ala nafsi su'an aw ajurrahu ila muslim", translation: "O Allah, Knower of the unseen and the seen, Creator of the heavens and the earth, Lord and Sovereign of all things, I bear witness that none has the right to be worshipped except You. I seek refuge in You from the evil of myself, from the evil and shirk of Satan, and from wronging my own soul or bringing such wrong upon a Muslim", count: 1 },
      { id: 'm14', arabic: 'رَضِيتُ بِاللَّهِ رَبًّا، وَبِالْإِسْلَامِ دِينًا، وَبِمُحَمَّدٍ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ نَبِيًّا', transliteration: "Radeetu billahi rabban, wa bil-Islami dinan, wa bi-Muhammadin sallallahu 'alayhi wa sallama nabiyya", translation: "I am pleased with Allah as a Lord, and Islam as a religion, and Muhammad (peace be upon him) as a Prophet", count: 3 },
      { id: 'm15', arabic: 'يَا حَيُّ يَا قَيُّومُ بِرَحْمَتِكَ أَسْتَغِيثُ، أَصْلِحْ لِي شَأْنِي كُلَّهُ، وَلَا تَكِلْنِي إِلَى نَفْسِي طَرْفَةَ عَيْنٍ', transliteration: "Ya Hayyu Ya Qayyumu birahmatika astagheeth, aslih li sha'ni kullahu, wa la takilni ila nafsi tarfata 'ayn", translation: "O Ever-Living, O Self-Subsisting and Supporter of all, by Your mercy I seek relief. Set right all my affairs and do not leave me to myself, even for the blink of an eye", count: 1 },
      { id: 'm16', arabic: 'أَصْبَحْنَا عَلَى فِطْرَةِ الْإِسْلَامِ، وَعَلَى كَلِمَةِ الْإِخْلَاصِ، وَعَلَى دِينِ نَبِيِّنَا مُحَمَّدٍ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ، وَعَلَى مِلَّةِ أَبِينَا إِبْرَاهِيمَ، حَنِيفًا مُسْلِمًا وَمَا كَانَ مِنَ الْمُشْرِكِينَ', transliteration: "Asbahna 'ala fitratil-Islam, wa 'ala kalimatil-ikhlas, wa 'ala dini nabiyyina Muhammadin sallallahu 'alayhi wa sallam, wa 'ala millati abina Ibrahima hanifan musliman wa ma kana minal-mushrikin", translation: "We rise upon the natural religion of Islam, upon the word of sincere devotion, upon the religion of our Prophet Muhammad (peace be upon him), and upon the faith of our father Abraham, who was upright in submission and not among those who associate partners with Allah", count: 1 },
      { id: 'm17', arabic: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ عَدَدَ خَلْقِهِ، وَرِضَا نَفْسِهِ، وَزِنَةَ عَرْشِهِ، وَمِدَادَ كَلِمَاتِهِ', transliteration: "Subhanallahi wa bihamdihi, 'adada khalqihi, wa rida nafsihi, wa zinata 'arshihi, wa midada kalimatih", translation: "Glory and praise be to Allah, by the number of His creation, by His own pleasure, by the weight of His Throne, and by the extent of His words", count: 3 },
      { id: 'm18', arabic: 'أَسْتَغْفِرُ اللَّهَ وَأَتُوبُ إِلَيْهِ', transliteration: "Astaghfirullaha wa atubu ilayh", translation: "I seek Allah's forgiveness and turn to Him in repentance", count: 100 },
      { id: 'm19', arabic: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ قُلْ هُوَ اللَّهُ أَحَدٌ * اللَّهُ الصَّمَدُ * لَمْ يَلِدْ وَلَمْ يُولَدْ * وَلَمْ يَكُن لَّهُ كُفُواً أَحَدٌ — بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ * مِنْ شَرِّ مَا خَلَقَ * وَمِنْ شَرِّ غَاسِقٍ إِذَا وَقَبَ * وَمِنْ شَرِّ النَّفَّاثَاتِ فِي الْعُقَدِ * وَمِنْ شَرِّ حَاسِدٍ إِذَا حَسَدَ — بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ قُلْ أَعُوذُ بِرَبِّ النَّاسِ * مَلِكِ النَّاسِ * إِلَٰهِ النَّاسِ * مِنْ شَرِّ الْوَسْوَاسِ الْخَنَّاسِ * الَّذِي يُوَسْوِسُ فِي صُدُورِ النَّاسِ * مِنَ الْجِنَّةِ وَالنَّاسِ', transliteration: "Surah Al-Ikhlas, Al-Falaq, and An-Nas", translation: "Recite Surahs Al-Ikhlas, Al-Falaq, and An-Nas (each protects from all harm)", count: 3 },
      { id: 'm20', arabic: 'أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ رَبِّ الْعَالَمِينَ، اللَّهُمَّ إِنِّي أَسْأَلُكَ خَيْرَ هَذَا الْيَوْمِ: فَتْحَهُ، وَنَصْرَهُ، وَنُورَهُ، وَبَرَكَتَهُ، وَهُدَاهُ، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِيهِ وَشَرِّ مَا بَعْدَهُ', transliteration: "Asbahna wa asbahal-mulku lillahi Rabbil-'alameen, Allahumma inni as'aluka khayra hadha al-yawmi: fat'hahu, wa nasrahu, wa nurahu, wa barakatahu, wa hudah, wa a'udhu bika min sharri ma fihi wa sharri ma ba'dah", translation: "We have reached the morning and with it all dominion belongs to Allah, Lord of all the worlds. O Allah, I ask You for the good of this day: its opening, its help, its light, its blessing, and its guidance, and I seek refuge in You from the evil that is in it and the evil that follows it", count: 1 },
      { id: 'm21', arabic: 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ لَهُ مَا فِي السَّمَاوَاتِ وَمَا فِي الْأَرْضِ مَنْ ذَا الَّذِي يَشْفَعُ عِنْدَهُ إِلَّا بِإِذْنِهِ يَعْلَمُ مَا بَيْنَ أَيْدِيهِمْ وَمَا خَلْفَهُمْ وَلَا يُحِيطُونَ بِشَيْءٍ مِنْ عِلْمِهِ إِلَّا بِمَا شَاءَ وَسِعَ كُرْسِيُّهُ السَّمَاوَاتِ وَالْأَرْضَ وَلَا يَئُودُهُ حِفْظُهُمَا وَهُوَ الْعَلِيُّ الْعَظِيمُ', transliteration: "Allahu la ilaha illa Huwa, al-Hayyul-Qayyum, la ta'khudhuhu sinatun wa la nawm, lahu ma fis-samawati wa ma fil-ard, man dhal-ladhi yashfa'u 'indahu illa bi-idhnih, ya'lamu ma bayna aydihim wa ma khalfahum, wa la yuhituna bi-shay'in min 'ilmihi illa bima sha', wasi'a kursiyyuhus-samawati wal-ard, wa la ya'uduhu hifdhuhuma, wa Huwal-'Aliyyul-'Adheem", translation: "Ayat al-Kursi (Quran 2:255): Allah - there is no deity except Him, the Ever-Living, the Sustainer of all existence. Neither drowsiness overtakes Him nor sleep. To Him belongs whatever is in the heavens and whatever is on the earth. Who is it that can intercede with Him except by His permission? He knows what is before them and what will be after them, and they encompass not a thing of His knowledge except for what He wills. His Kursi extends over the heavens and the earth, and their preservation tires Him not, and He is the Most High, the Most Great", count: 1 },
      { id: 'm22', arabic: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ عِلْمًا نَافِعًا، وَرِزْقًا طَيِّبًا، وَعَمَلًا مُتَقَبَّلًا', transliteration: "Allahumma inni as'aluka 'ilman nafi'an, wa rizqan tayyiban, wa 'amalan mutaqabbalan", translation: "O Allah, I ask You for beneficial knowledge, good provision, and accepted deeds", count: 1 },
      { id: 'm23', arabic: 'سُبْحَانَ اللَّهِ، وَالْحَمْدُ لِلَّهِ، وَاللَّهُ أَكْبَرُ، لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ', transliteration: "Subhanallah, wal-hamdu lillah, wallahu akbar, la ilaha illallahu wahdahu la sharika lah, lahul-mulku wa lahul-hamd, wa huwa 'ala kulli shay'in qadir", translation: "Glory be to Allah, praise be to Allah, Allah is the Greatest, none has the right to be worshipped except Allah alone, He has no partner. His is the dominion and His is the praise, and He is over all things omnipotent", count: 100 },
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
    id: 'evening',
    nameAr: 'أذكار المساء',
    nameEn: 'Evening Adhkar',
    icon: '🌙',
    items: [
      { id: 'e1', arabic: 'أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ وَالْحَمْدُ لِلَّهِ، لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ، رَبِّ أَسْأَلُكَ خَيْرَ مَا فِي هَذِهِ اللَّيْلَةِ وَخَيْرَ مَا بَعْدَهَا، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِي هَذِهِ اللَّيْلَةِ وَشَرِّ مَا بَعْدَهَا، رَبِّ أَعُوذُ بِكَ مِنَ الْكَسَلِ وَسُوءِ الْكِبَرِ، رَبِّ أَعُوذُ بِكَ مِنْ عَذَابٍ فِي النَّارِ وَعَذَابٍ فِي الْقَبْرِ', transliteration: "Amsayna wa amsal-mulku lillahi wal-hamdu lillah, la ilaha illallahu wahdahu la sharika lah, lahul-mulku wa lahul-hamdu wa huwa 'ala kulli shay'in qadir, Rabbi as'aluka khayra ma fi hadhihil-laylati wa khayra ma ba'daha, wa a'udhu bika min sharri ma fi hadhihil-laylati wa sharri ma ba'daha, Rabbi a'udhu bika minal-kasali wa su'il-kibar, Rabbi a'udhu bika min 'adhabin fin-nari wa 'adhabin fil-qabr", translation: "We have reached the evening and with it all dominion belongs to Allah, and praise is to Allah. None has the right to be worshipped except Allah alone, He has no partner. His is the dominion and His is the praise, and He is over all things omnipotent. My Lord, I ask You for the good of this night and the good of what follows it, and I seek refuge in You from the evil of this night and the evil of what follows it. My Lord, I seek refuge in You from laziness and helpless old age. My Lord, I seek refuge in You from the punishment of the Fire and the punishment of the grave", count: 1 },
      { id: 'e2', arabic: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ', transliteration: "SubhanAllahi wa bihamdihi", translation: "Glory is to Allah and praise is to Him", count: 100 },
      { id: 'e3', arabic: 'أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ', transliteration: "A'udhu bikalimatillahit-tammati min sharri ma khalaq", translation: "I seek refuge in the perfect words of Allah from the evil of what He has created", count: 3 },
      { id: 'e4', arabic: 'اللَّهُمَّ بِكَ أَمْسَيْنَا، وَبِكَ أَصْبَحْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ وَإِلَيْكَ الْمَصِيرُ', transliteration: "Allahumma bika amsayna, wa bika asbahna, wa bika nahya, wa bika namutu wa ilaykal-masir", translation: "O Allah, by You we have reached the evening, and by You we have reached the morning, by You we live and by You we die, and to You is the final return", count: 1 },
      { id: 'e5', arabic: 'اللَّهُمَّ مَا أَمْسَى بِي مِنْ نِعْمَةٍ فَمِنْكَ', transliteration: "Allahumma ma amsa bi min ni'matin faminka", translation: "O Allah, whatever blessing has been received by me is from You", count: 1 },
      { id: 'e6', arabic: 'لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ', transliteration: "La ilaha illAllahu wahdahu la sharika lah, lahul-mulku wa lahul-hamdu wa huwa 'ala kulli shay'in qadir", translation: "None has the right to be worshipped except Allah alone, He has no partner. His is the dominion and His is the praise, and He is over all things omnipotent", count: 10 },
      { id: 'e7', arabic: 'اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَٰهَ إِلَّا أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَى عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ، أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ، أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ، وَأَبُوءُ بِذَنْبِي فَاغْفِرْ لِي فَإِنَّهُ لَا يَغْفِرُ الذُّنُوبَ إِلَّا أَنْتَ', transliteration: "Allahumma anta Rabbi la ilaha illa anta, khalaqtani wa ana 'abduka, wa ana 'ala 'ahdika wa wa'dika mas-tata't, a'udhu bika min sharri ma sana't, abu'u laka bini'matika 'alayya, wa abu'u bidhanbi faghfir li fa-innahu la yaghfirudh-dhunuba illa ant", translation: "O Allah, You are my Lord, none has the right to be worshipped except You. You created me and I am Your servant, and I abide by Your covenant and promise as best I can. I seek refuge in You from the evil of what I have done. I acknowledge Your favor upon me, and I acknowledge my sin, so forgive me, for none forgives sins except You (Sayyid al-Istighfar)", count: 1 },
      { id: 'e8', arabic: 'اللَّهُمَّ إِنِّي أَمْسَيْتُ أُشْهِدُكَ وَأُشْهِدُ حَمَلَةَ عَرْشِكَ، وَمَلاَئِكَتِكَ، وَجَمِيعَ خَلْقِكَ، أَنَّكَ أَنْتَ اللَّهُ لَا إِلَٰهَ إِلَّا أَنْتَ وَحْدَكَ لَا شَرِيكَ لَكَ، وَأَنَّ مُحَمَّدًا عَبْدُكَ وَرَسُولُكَ', transliteration: "Allahumma inni amsaytu ush-hiduka wa ush-hidu hamalata 'arshika, wa mala'ikatika, wa jami'a khalqika, annaka antallahu la ilaha illa anta wahdaka la sharika laka, wa anna Muhammadan 'abduka wa rasuluk", translation: "O Allah, I have reached the evening and call on You, on the bearers of Your Throne, on Your angels and all creation to witness that You are Allah, none has the right to be worshipped except You alone, You have no partner, and that Muhammad is Your servant and Messenger", count: 4 },
      { id: 'e9', arabic: 'اللَّهُمَّ عَافِنِي فِي بَدَنِي، اللَّهُمَّ عَافِنِي فِي سَمْعِي، اللَّهُمَّ عَافِنِي فِي بَصَرِي، لَا إِلَٰهَ إِلَّا أَنْتَ. اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْكُفْرِ وَالْفَقْرِ، وَأَعُوذُ بِكَ مِنْ عَذَابِ الْقَبْرِ، لَا إِلَٰهَ إِلَّا أَنْتَ', transliteration: "Allahumma 'afini fi badani, Allahumma 'afini fi sam'i, Allahumma 'afini fi basari, la ilaha illa ant. Allahumma inni a'udhu bika minal-kufri wal-faqr, wa a'udhu bika min 'adhabil-qabr, la ilaha illa ant", translation: "O Allah, grant my body health, O Allah, grant my hearing health, O Allah, grant my sight health, none has the right to be worshipped except You. O Allah, I seek refuge in You from disbelief and poverty, and from the punishment of the grave, none has the right to be worshipped except You", count: 3 },
      { id: 'e10', arabic: 'اللَّهُمَّ عَالِمَ الْغَيْبِ وَالشَّهَادَةِ فَاطِرَ السَّمَاوَاتِ وَالْأَرْضِ، رَبَّ كُلِّ شَيْءٍ وَمَلِيكَهُ، أَشْهَدُ أَنْ لَا إِلَٰهَ إِلَّا أَنْتَ، أَعُوذُ بِكَ مِنْ شَرِّ نَفْسِي، وَمِنْ شَرِّ الشَّيْطَانِ وَشِرْكِهِ، وَأَنْ أَقْتَرِفَ عَلَى نَفْسِي سُوءًا أَوْ أَجُرَّهُ إِلَى مُسْلِمٍ', transliteration: "Allahumma 'Alimal-ghaybi wash-shahadah, Fatiras-samawati wal-ard, Rabba kulli shay'in wa malikahu, ash-hadu al-la ilaha illa ant, a'udhu bika min sharri nafsi, wa min sharrish-shaytani wa shirkihi, wa an aqtarifa 'ala nafsi su'an aw ajurrahu ila muslim", translation: "O Allah, Knower of the unseen and the seen, Creator of the heavens and the earth, Lord and Sovereign of all things, I bear witness that none has the right to be worshipped except You. I seek refuge in You from the evil of myself, from the evil and shirk of Satan, and from wronging my own soul or bringing such wrong upon a Muslim", count: 1 },
      { id: 'e11', arabic: 'رَضِيتُ بِاللَّهِ رَبًّا، وَبِالْإِسْلَامِ دِينًا، وَبِمُحَمَّدٍ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ نَبِيًّا', transliteration: "Radeetu billahi rabban, wa bil-Islami dinan, wa bi-Muhammadin sallallahu 'alayhi wa sallama nabiyya", translation: "I am pleased with Allah as a Lord, and Islam as a religion, and Muhammad (peace be upon him) as a Prophet", count: 3 },
      { id: 'e12', arabic: 'يَا حَيُّ يَا قَيُّومُ بِرَحْمَتِكَ أَسْتَغِيثُ، أَصْلِحْ لِي شَأْنِي كُلَّهُ، وَلَا تَكِلْنِي إِلَى نَفْسِي طَرْفَةَ عَيْنٍ', transliteration: "Ya Hayyu Ya Qayyumu birahmatika astagheeth, aslih li sha'ni kullahu, wa la takilni ila nafsi tarfata 'ayn", translation: "O Ever-Living, O Self-Subsisting and Supporter of all, by Your mercy I seek relief. Set right all my affairs and do not leave me to myself, even for the blink of an eye", count: 1 },
      { id: 'e13', arabic: 'أَمْسَيْنَا عَلَى فِطْرَةِ الْإِسْلَامِ، وَعَلَى كَلِمَةِ الْإِخْلَاصِ، وَعَلَى دِينِ نَبِيِّنَا مُحَمَّدٍ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ، وَعَلَى مِلَّةِ أَبِينَا إِبْرَاهِيمَ، حَنِيفًا مُسْلِمًا وَمَا كَانَ مِنَ الْمُشْرِكِينَ', transliteration: "Amsayna 'ala fitratil-Islam, wa 'ala kalimatil-ikhlas, wa 'ala dini nabiyyina Muhammadin sallallahu 'alayhi wa sallam, wa 'ala millati abina Ibrahima hanifan musliman wa ma kana minal-mushrikin", translation: "We reach the evening upon the natural religion of Islam, upon the word of sincere devotion, upon the religion of our Prophet Muhammad (peace be upon him), and upon the faith of our father Abraham, who was upright in submission and not among those who associate partners with Allah", count: 1 },
      { id: 'e14', arabic: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ عَدَدَ خَلْقِهِ، وَرِضَا نَفْسِهِ، وَزِنَةَ عَرْشِهِ، وَمِدَادَ كَلِمَاتِهِ', transliteration: "Subhanallahi wa bihamdihi, 'adada khalqihi, wa rida nafsihi, wa zinata 'arshihi, wa midada kalimatih", translation: "Glory and praise be to Allah, by the number of His creation, by His own pleasure, by the weight of His Throne, and by the extent of His words", count: 3 },
      { id: 'e15', arabic: 'أَسْتَغْفِرُ اللَّهَ وَأَتُوبُ إِلَيْهِ', transliteration: "Astaghfirullaha wa atubu ilayh", translation: "I seek Allah's forgiveness and turn to Him in repentance", count: 100 },
      { id: 'e16', arabic: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ قُلْ هُوَ اللَّهُ أَحَدٌ * اللَّهُ الصَّمَدُ * لَمْ يَلِدْ وَلَمْ يُولَدْ * وَلَمْ يَكُن لَّهُ كُفُواً أَحَدٌ — بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ * مِنْ شَرِّ مَا خَلَقَ * وَمِنْ شَرِّ غَاسِقٍ إِذَا وَقَبَ * وَمِنْ شَرِّ النَّفَّاثَاتِ فِي الْعُقَدِ * وَمِنْ شَرِّ حَاسِدٍ إِذَا حَسَدَ — بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ قُلْ أَعُوذُ بِرَبِّ النَّاسِ * مَلِكِ النَّاسِ * إِلَٰهِ النَّاسِ * مِنْ شَرِّ الْوَسْوَاسِ الْخَنَّاسِ * الَّذِي يُوَسْوِسُ فِي صُدُورِ النَّاسِ * مِنَ الْجِنَّةِ وَالنَّاسِ', transliteration: "Surah Al-Ikhlas, Al-Falaq, and An-Nas", translation: "Recite Surahs Al-Ikhlas, Al-Falaq, and An-Nas (each protects from all harm)", count: 3 },
      { id: 'e17', arabic: 'أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ رَبِّ الْعَالَمِينَ، اللَّهُمَّ إِنِّي أَسْأَلُكَ خَيْرَ هَذِهِ اللَّيْلَةِ: فَتْحَهَا، وَنَصْرَهَا، وَنُورَهَا، وَبَرَكَتَهَا، وَهُدَاهَا، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِيهَا وَشَرِّ مَا بَعْدَهَا', transliteration: "Amsayna wa amsal-mulku lillahi Rabbil-'alameen, Allahumma inni as'aluka khayra hadhihil-laylati: fat'haha, wa nasraha, wa nuraha, wa barakataha, wa hudaha, wa a'udhu bika min sharri ma fiha wa sharri ma ba'daha", translation: "We have reached the evening and with it all dominion belongs to Allah, Lord of all the worlds. O Allah, I ask You for the good of this night: its opening, its help, its light, its blessing, and its guidance, and I seek refuge in You from the evil that is in it and the evil that follows it", count: 1 },
      { id: 'e18', arabic: 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ لَهُ مَا فِي السَّمَاوَاتِ وَمَا فِي الْأَرْضِ مَنْ ذَا الَّذِي يَشْفَعُ عِنْدَهُ إِلَّا بِإِذْنِهِ يَعْلَمُ مَا بَيْنَ أَيْدِيهِمْ وَمَا خَلْفَهُمْ وَلَا يُحِيطُونَ بِشَيْءٍ مِنْ عِلْمِهِ إِلَّا بِمَا شَاءَ وَسِعَ كُرْسِيُّهُ السَّمَاوَاتِ وَالْأَرْضَ وَلَا يَئُودُهُ حِفْظُهُمَا وَهُوَ الْعَلِيُّ الْعَظِيمُ', transliteration: "Allahu la ilaha illa Huwa, al-Hayyul-Qayyum, la ta'khudhuhu sinatun wa la nawm, lahu ma fis-samawati wa ma fil-ard, man dhal-ladhi yashfa'u 'indahu illa bi-idhnih, ya'lamu ma bayna aydihim wa ma khalfahum, wa la yuhituna bi-shay'in min 'ilmihi illa bima sha', wasi'a kursiyyuhus-samawati wal-ard, wa la ya'uduhu hifdhuhuma, wa Huwal-'Aliyyul-'Adheem", translation: "Ayat al-Kursi (Quran 2:255): Allah - there is no deity except Him, the Ever-Living, the Sustainer of all existence. Neither drowsiness overtakes Him nor sleep. To Him belongs whatever is in the heavens and whatever is on the earth. Who is it that can intercede with Him except by His permission? He knows what is before them and what will be after them, and they encompass not a thing of His knowledge except for what He wills. His Kursi extends over the heavens and the earth, and their preservation tires Him not, and He is the Most High, the Most Great", count: 1 },
      { id: 'e19', arabic: 'بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ وَهُوَ السَّمِيعُ الْعَلِيمُ', transliteration: "Bismillahil-ladhi la yadurru ma'a-smihi shay'un fil-ardi wa la fis-sama'i wa huwas-Sami'ul-'Alim", translation: "In the name of Allah, with whose name nothing can cause harm on earth nor in the heaven, and He is the All-Hearing, the All-Knowing", count: 3 },
      { id: 'e20', arabic: 'حَسْبِيَ اللَّهُ لَا إِلَهَ إِلَّا هُوَ', transliteration: "HasbiyAllahu la ilaha illa Huwa", translation: "Allah is sufficient for me, there is no god but He", count: 7 },
      { id: 'e21', arabic: 'سُبْحَانَ اللَّهِ، وَالْحَمْدُ لِلَّهِ، وَاللَّهُ أَكْبَرُ، لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ', transliteration: "Subhanallah, wal-hamdu lillah, wallahu akbar, la ilaha illallahu wahdahu la sharika lah, lahul-mulku wa lahul-hamd, wa huwa 'ala kulli shay'in qadir", translation: "Glory be to Allah, praise be to Allah, Allah is the Greatest, none has the right to be worshipped except Allah alone, He has no partner. His is the dominion and His is the praise, and He is over all things omnipotent", count: 100 },
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
      <PageHeader icon="🍃" title={t('adhkar')} />
      <div className="px-4 pt-2">
        <p className="text-muted-foreground text-sm">{totalDone}/{totalRequired} {t('completed')}</p>
      </div>

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
            className="h-full bg-[#D4A017] rounded-full transition-all duration-300"
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