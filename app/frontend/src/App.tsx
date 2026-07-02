import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';
import { LanguageProvider, hasLanguagePreference } from '@/contexts/LanguageContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import ErrorBoundary from '@/components/ErrorBoundary';
import Onboarding from '@/components/Onboarding';
import Index from './pages/Index';
import Login from './pages/Login';
import AuthCallback from './pages/AuthCallback';
import AuthError from './pages/AuthError';
import PrayerTimes from './pages/PrayerTimes';
import QuranReader from './pages/QuranReader';
import DhikrCounter from './pages/DhikrCounter';
import DuasCollection from './pages/DuasCollection';
import QiblaFinder from './pages/QiblaFinder';
import ZakatCalculator from './pages/ZakatCalculator';
import IslamicCalendar from './pages/IslamicCalendar';
import Welcome from './pages/Welcome';
import DailyRoutine from './pages/DailyRoutine';
import FastingTracker from './pages/FastingTracker';
import TaskManager from './pages/TaskManager';
import Adhkar from './pages/Adhkar';
import Finance from './pages/Finance';
import Goals from './pages/Goals';
import Wellness from './pages/Wellness';
import Planner from './pages/Planner';
import Settings from './pages/Settings';
import Subscription from './pages/Subscription';
import AIPlanning from './pages/AIPlanning';
import AISearch from './pages/AISearch';
import FamilyBudget from './pages/FamilyBudget';
import FinancialDashboard from './pages/FinancialDashboard';
import HalalInvestment from './pages/HalalInvestment';
import RamadanPlanner from './pages/RamadanPlanner';
import ClassicSearch from './pages/ClassicSearch';
import ProgressAnalytics from './pages/ProgressAnalytics';
import FamilySharedDashboard from './pages/FamilySharedDashboard';
import BillReminders from './pages/BillReminders';
import AILifeCoach from './pages/AILifeCoach';
import WeeklyLifeScore from './pages/WeeklyLifeScore';
import SmartSavingsChallenges from './pages/SmartSavingsChallenges';
import ReceiptScanner from './pages/ReceiptScanner';
import BlogRoutes from './blog-routes';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import RefundPolicy from './pages/RefundPolicy';
import ContactSupport from './pages/ContactSupport';
import PricingPage from './pages/PricingPage';
import LandingPage from './pages/LandingPage';
import ResetPassword from './pages/ResetPassword';
import About from './pages/About';

const queryClient = new QueryClient();

function WelcomeGuard() {
  if (!hasLanguagePreference()) {
    return <Navigate to="/landing" replace />;
  }
  return <Index />;
}

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<WelcomeGuard />} />
    <Route path="/welcome" element={<Welcome />} />
    <Route path="/login" element={<Login />} />
    <Route path="/auth/callback" element={<AuthCallback />} />
    <Route path="/auth/error" element={<AuthError />} />
    <Route path="/prayer-times" element={<PrayerTimes />} />
    <Route path="/quran" element={<QuranReader />} />
    <Route path="/dhikr" element={<DhikrCounter />} />
    <Route path="/duas" element={<DuasCollection />} />
    <Route path="/qibla" element={<QiblaFinder />} />
    <Route path="/giving-tracker" element={<ZakatCalculator />} />
    <Route path="/calendar" element={<IslamicCalendar />} />
    <Route path="/daily-routine" element={<DailyRoutine />} />
    <Route path="/fasting" element={<FastingTracker />} />
    <Route path="/tasks" element={<TaskManager />} />
    <Route path="/adhkar" element={<Adhkar />} />
    <Route path="/finance" element={<Finance />} />
    <Route path="/goals" element={<Goals />} />
    <Route path="/wellness" element={<Wellness />} />
    <Route path="/planner" element={<Planner />} />
    <Route path="/settings" element={<Settings />} />
    <Route path="/subscription" element={<Subscription />} />
    <Route path="/ai-planning" element={<AIPlanning />} />
    <Route path="/ai-search" element={<AISearch />} />
    <Route path="/family-budget" element={<FamilyBudget />} />
    <Route path="/financial-dashboard" element={<FinancialDashboard />} />
    <Route path="/halal-investment" element={<HalalInvestment />} />
    <Route path="/ramadan-planner" element={<RamadanPlanner />} />
    <Route path="/search" element={<ClassicSearch />} />
    <Route path="/progress-analytics" element={<ProgressAnalytics />} />
    <Route path="/family-dashboard" element={<FamilySharedDashboard />} />
    <Route path="/bill-reminders" element={<BillReminders />} />
    <Route path="/ai-life-coach" element={<AILifeCoach />} />
    <Route path="/weekly-life-score" element={<WeeklyLifeScore />} />
    <Route path="/savings-challenges" element={<SmartSavingsChallenges />} />
    <Route path="/receipt-scanner" element={<ReceiptScanner />} />
    <Route path="/privacy" element={<PrivacyPolicy />} />
    <Route path="/terms" element={<TermsOfService />} />
    <Route path="/refund" element={<RefundPolicy />} />
    <Route path="/contact" element={<ContactSupport />} />
    <Route path="/pricing" element={<PricingPage />} />
    <Route path="/landing" element={<LandingPage />} />
    <Route path="/about" element={<About />} />
    <Route path="/reset-password" element={<ResetPassword />} />
    <Route path="/blog/*" element={<BlogRoutes />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <BrowserRouter>
          <ThemeProvider>
            <LanguageProvider>
              <AuthProvider>
                <SubscriptionProvider>
                  <Onboarding />
                  <AppRoutes />
                </SubscriptionProvider>
              </AuthProvider>
            </LanguageProvider>
          </ThemeProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
export { AppRoutes };