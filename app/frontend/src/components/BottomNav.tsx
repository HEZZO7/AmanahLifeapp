import { useNavigate, useLocation } from 'react-router-dom';

const NAV_ITEMS = [
  { path: '/', icon: '🏠', label: 'Home' },
  { path: '/prayer-times', icon: '🕌', label: 'Prayer' },
  { path: '/quran', icon: '📖', label: 'Quran' },
  { path: '/dhikr', icon: '📿', label: 'Dhikr' },
  { path: '/duas', icon: '🤲', label: 'Duas' },
];

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-gray-200 shadow-lg">
      <div className="max-w-lg mx-auto flex items-center justify-around h-16 px-2">
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${
                isActive
                  ? 'bg-emerald-50 scale-105'
                  : 'hover:bg-gray-50 active:scale-95'
              }`}
            >
              <span className={`text-xl transition-transform ${isActive ? 'scale-110' : ''}`}>
                {item.icon}
              </span>
              <span
                className={`text-[10px] font-medium transition-colors ${
                  isActive ? 'text-emerald-700' : 'text-gray-500'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}