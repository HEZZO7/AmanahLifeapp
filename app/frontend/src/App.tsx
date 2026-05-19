import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
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

const queryClient = new QueryClient();

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<Index />} />
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
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
export { AppRoutes };