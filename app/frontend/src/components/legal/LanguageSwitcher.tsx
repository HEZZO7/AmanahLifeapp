import LanguageSwitcherLink from '@/components/LanguageSwitcherLink';

type LegalLanguageSwitcherProps = {
  /** The current page's own path, e.g. "/privacy" or "/privacy/ar". */
  currentPath: string;
};

const switcherLabels = {
  toArabic: 'العربية',
  toEnglish: 'English',
};

// Every legal page has exactly one counterpart at a fixed /<path>/ar swap -
// unlike /wealth/'s LanguageSwitcher, there's no content list to look up
// against and no "not translated yet" case to guard against, since all
// three legal pages ship both languages together.
const LanguageSwitcher = ({ currentPath }: LegalLanguageSwitcherProps) => {
  const isArabic = currentPath.endsWith('/ar');
  const counterpartPath = isArabic
    ? currentPath.replace(/\/ar$/, '')
    : `${currentPath}/ar`;
  const label = isArabic ? switcherLabels.toEnglish : switcherLabels.toArabic;

  return <LanguageSwitcherLink href={counterpartPath} label={label} />;
};

export default LanguageSwitcher;
