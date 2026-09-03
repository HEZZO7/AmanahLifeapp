import { getWealthPost, getWealthRoute } from '@/lib/wealth';
import LanguageSwitcherLink from '@/components/LanguageSwitcherLink';

type LanguageSwitcherProps = {
  currentSlug: string;
};

const switcherLabels = {
  toArabic: 'العربية',
  toEnglish: 'English',
};

// Language pairing is purely by filename convention (seo/wealth-content/<slug>.md
// <-> seo/wealth-content/ar/<slug>.md), same as /blog/ - there's no explicit
// "translation_of" field. This looks up the counterpart post directly rather
// than assuming it exists, so a slug with only one language never renders a
// broken link.
const LanguageSwitcher = ({ currentSlug }: LanguageSwitcherProps) => {
  const isArabic = currentSlug.startsWith('ar/');
  const counterpartSlug = isArabic
    ? currentSlug.replace(/^ar\//, '')
    : `ar/${currentSlug}`;
  const counterpart = getWealthPost(counterpartSlug);

  if (!counterpart) {
    return null;
  }

  const label = isArabic ? switcherLabels.toEnglish : switcherLabels.toArabic;

  return <LanguageSwitcherLink href={getWealthRoute(counterpartSlug)} label={label} />;
};

export default LanguageSwitcher;
