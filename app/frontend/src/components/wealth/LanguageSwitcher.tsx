import { Link } from 'react-router-dom';
import { Globe } from 'lucide-react';
import { getWealthPost, getWealthRoute } from '@/lib/wealth';

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

  return (
    <Link
      to={getWealthRoute(counterpartSlug)}
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-primary/50 hover:text-primary"
    >
      <Globe className="h-3.5 w-3.5" />
      {label}
    </Link>
  );
};

export default LanguageSwitcher;
