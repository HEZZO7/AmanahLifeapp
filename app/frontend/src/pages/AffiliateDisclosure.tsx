import { useSEO } from '@/hooks/useSEO';
import PageHeader from '@/components/PageHeader';
import Footer from '@/components/Footer';
import LanguageSwitcher from '@/components/legal/LanguageSwitcher';
import { getLegalPageMeta } from '@/lib/legalPages';

const meta = getLegalPageMeta('/affiliate-disclosure')!;

const sections = [
  {
    title: 'What This Means',
    content: 'AmanahLife, including its AmanahWealth section, participates in affiliate partnerships with select financial products and services mentioned in our content. If you click a link to one of these products and subsequently open an account, subscribe, or make a purchase, we may earn a commission. This comes at no additional cost to you.',
  },
  {
    title: "What This Doesn't Mean",
    content: "A commission relationship does not influence which topics we cover or what we conclude about a product's Sharia compliance or suitability. Our screening explanations and educational content are based on published standards (such as AAOIFI) and publicly available information, independent of any commercial relationship.",
  },
  {
    title: 'Our Commitment',
    content: "We never recommend a product solely because it pays a commission. We disclose affiliate relationships clearly in each article where they appear. We link to a provider's official site as our default; any affiliate tracking link replaces that only where a formal partnership exists. Editorial content and product recommendations remain separate from any advertising or affiliate arrangement.",
  },
  {
    title: 'Important Note',
    content: 'We are not a licensed financial advisor or Sharia scholar. Content on this site is for general educational purposes and does not constitute individual financial or religious advice. Always verify current terms, fees, and Sharia compliance status directly with any provider before investing.',
  },
];

export default function AffiliateDisclosure() {
  useSEO({ title: meta.title, description: meta.description });

  return (
    <div className="min-h-screen bg-background" dir="ltr">
      <PageHeader icon="🤝" title="Affiliate Disclosure" />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <p className="text-muted-foreground">
            This page explains how AmanahLife may earn a commission from links in our content.
          </p>
          <LanguageSwitcher currentPath="/affiliate-disclosure" />
        </div>

        <div className="space-y-6">
          {sections.map((section, index) => (
            <div key={index} className="bg-card border border-border rounded-xl p-5">
              <h2 className="text-lg font-bold text-foreground mb-3">{section.title}</h2>
              <p className="text-muted-foreground leading-relaxed">{section.content}</p>
            </div>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}
