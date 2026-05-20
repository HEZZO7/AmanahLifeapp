import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';
import { LanguageProvider, hasLanguagePreference } from '@/contexts/LanguageContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
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

const queryClient = new QueryClient();

function WelcomeGuard() {
  if (!hasLanguagePreference()) {
    return <Navigate to="/welcome" replace />;
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
    <Route path="/zakat" element={<ZakatCalculator />} />
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
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <ThemeProvider>
          <LanguageProvider>
            <AuthProvider>
              <SubscriptionProvider>
                <AppRoutes />
              </SubscriptionProvider>
            </AuthProvider>
          </LanguageProvider>
        </ThemeProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
export { AppRoutes };