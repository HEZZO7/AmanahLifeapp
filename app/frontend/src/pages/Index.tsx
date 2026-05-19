import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

export default function HomePage() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900">AmanahLife</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <Button variant="ghost" size="sm" onClick={signOut} className="text-gray-600 hover:text-gray-900">
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Assalamu Alaikum! 👋</h2>
          <p className="text-gray-500 mt-1">Welcome to your Islamic life companion</p>
        </div>

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <QuickAction
            icon="🕌"
            title="Prayer Times"
            description="Track your daily prayers"
            color="bg-blue-50 border-blue-200"
            onClick={() => navigate('/prayer-times')}
          />
          <QuickAction
            icon="📖"
            title="Quran"
            description="Read & track progress"
            color="bg-purple-50 border-purple-200"
            onClick={() => navigate('/quran')}
          />
          <QuickAction
            icon="🤲"
            title="Duas"
            description="Daily supplications"
            color="bg-amber-50 border-amber-200"
            onClick={() => navigate('/duas')}
          />
          <QuickAction
            icon="📿"
            title="Dhikr"
            description="Remembrance counter"
            color="bg-teal-50 border-teal-200"
            onClick={() => navigate('/dhikr')}
          />
          <QuickAction
            icon="🌙"
            title="Ramadan"
            description="Fasting tracker"
            color="bg-indigo-50 border-indigo-200"
            comingSoon
          />
          <QuickAction
            icon="💰"
            title="Zakat"
            description="Calculate & track"
            color="bg-green-50 border-green-200"
            comingSoon
          />
          <QuickAction
            icon="🧭"
            title="Qibla"
            description="Find direction"
            color="bg-orange-50 border-orange-200"
            comingSoon
          />
          <QuickAction
            icon="📅"
            title="Habits"
            description="Build good habits"
            color="bg-pink-50 border-pink-200"
            comingSoon
          />
        </div>

        {/* Coming Soon Notice */}
        <div className="mt-12 text-center p-8 rounded-2xl bg-white border border-gray-100 shadow-sm">
          <div className="text-4xl mb-3">🚀</div>
          <h3 className="text-lg font-semibold text-gray-900">More Features Coming Soon</h3>
          <p className="text-gray-500 mt-2 max-w-md mx-auto">
            Ramadan tracker, Zakat calculator, Qibla compass, and habit building features are on the way. Stay tuned!
          </p>
        </div>
      </main>
    </div>
  );
}

function QuickAction({ icon, title, description, color, onClick, comingSoon }: { icon: string; title: string; description: string; color: string; onClick?: () => void; comingSoon?: boolean }) {
  return (
    <div
      className={`p-4 rounded-xl border ${color} ${onClick ? 'hover:shadow-md cursor-pointer' : 'opacity-70'} transition-all relative`}
      onClick={onClick}
    >
      {comingSoon && (
        <span className="absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-600 font-medium">
          Soon
        </span>
      )}
      <div className="text-2xl mb-2">{icon}</div>
      <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
      <p className="text-xs text-gray-500 mt-0.5">{description}</p>
    </div>
  );
}