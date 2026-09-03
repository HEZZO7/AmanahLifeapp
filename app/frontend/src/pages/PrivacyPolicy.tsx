import { useSEO } from '@/hooks/useSEO';
import PageHeader from '@/components/PageHeader';
import Footer from '@/components/Footer';
import LanguageSwitcher from '@/components/legal/LanguageSwitcher';
import { getLegalPageMeta } from '@/lib/legalPages';

const meta = getLegalPageMeta('/privacy')!;

const sections = [
  {
    title: 'Information We Collect',
    content: 'Automatically collected data: IP address, browser type, device information, and pages visited, collected via standard analytics tools (e.g., Google Analytics) and advertising partners (e.g., Google AdSense). Cookies: We use cookies to understand site usage and to serve relevant advertising. Third-party vendors, including Google, use cookies to serve ads based on your prior visits to this or other websites. You can opt out of personalized advertising by visiting Google\'s Ads Settings. Voluntarily provided data: If you subscribe to a newsletter or contact us, we collect the information you provide (e.g., email address).',
  },
  {
    title: 'How We Use Information',
    content: "To operate and improve the site. To display relevant advertising through Google AdSense and other ad networks. To measure content performance and reader interest. To communicate with you if you've subscribed or contacted us directly.",
  },
  {
    title: 'Third-Party Advertising',
    content: "This site uses Google AdSense, a third-party advertising service. Google, as a third-party vendor, uses cookies to serve ads. Google's use of advertising cookies enables it and its partners to serve ads based on your visits to this site and other sites on the internet. You may opt out of personalized advertising by visiting Google Ads Settings (adssettings.google.com).",
  },
  {
    title: 'Affiliate Links',
    content: 'Some articles on this site, particularly in the AmanahWealth section, contain affiliate links. If you click one and make a purchase or open an account, we may earn a commission at no additional cost to you. See our Affiliate Disclosure page for full details.',
  },
  {
    title: 'Data Retention and Security',
    content: 'We retain data only as long as necessary for the purposes described above and take reasonable measures to protect it. No method of transmission over the internet is 100% secure.',
  },
  {
    title: 'Your Choices',
    content: "You can disable cookies through your browser settings, though this may affect site functionality. You can opt out of personalized ads via Google's Ads Settings linked above.",
  },
  {
    title: 'Changes to This Policy',
    content: 'We may update this policy periodically. Continued use of the site after changes constitutes acceptance of the updated policy.',
  },
];

export default function PrivacyPolicy() {
  useSEO({ title: meta.title, description: meta.description });

  return (
    <div className="min-h-screen bg-background" dir="ltr">
      <PageHeader icon="🔒" title="Privacy Policy" />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Last updated: September 3, 2026</p>
            <p className="text-muted-foreground mt-3">
              At AmanahLife, we value your privacy and are committed to protecting your personal data. This policy explains how we collect, use, and protect your information.
            </p>
          </div>
          <LanguageSwitcher currentPath="/privacy" />
        </div>

        <div className="space-y-6">
          {sections.map((section, index) => (
            <div key={index} className="bg-card border border-border rounded-xl p-5">
              <h2 className="text-lg font-bold text-foreground mb-3">{section.title}</h2>
              <p className="text-muted-foreground leading-relaxed">{section.content}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 bg-card border border-border rounded-xl p-5">
          <h2 className="text-lg font-bold text-foreground mb-3">Contact Us</h2>
          <p className="text-muted-foreground">
            If you have any questions about this privacy policy, please contact us at:
          </p>
          <a
            href="mailto:support@amanahlife.com"
            className="text-primary hover:underline mt-2 inline-block"
          >
            support@amanahlife.com
          </a>
        </div>
      </main>

      <Footer />
    </div>
  );
}
