import { Link } from 'react-router-dom';
import { Globe } from 'lucide-react';

type LanguageSwitcherLinkProps = {
  href: string;
  label: string;
};

// Pure presentational piece shared by every section's own language switcher
// (each section computes its own counterpart href/label from its own data
// model - /wealth/'s from its markdown post list, the legal pages' from a
// fixed EN/AR pair - and renders this).
const LanguageSwitcherLink = ({ href, label }: LanguageSwitcherLinkProps) => (
  <Link
    to={href}
    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-primary/50 hover:text-primary"
  >
    <Globe className="h-3.5 w-3.5" />
    {label}
  </Link>
);

export default LanguageSwitcherLink;
