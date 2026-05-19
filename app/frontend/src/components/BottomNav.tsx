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
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#0a2e1f]/95 backdrop-blur-md border-t border-[#1a4d35] shadow-lg">
      <div className="max-w-lg mx-auto flex items-center justify-around h-16 px-2">
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${
                isActive
                  ? 'bg-[#14b8a6]/20 scale-105'
                  : 'hover:bg-[#1a4d35] active:scale-95'
              }`}
            >
              <span className={`text-xl transition-transform ${isActive ? 'scale-110' : ''}`}>
                {item.icon}
              </span>
              <span
                className={`text-[10px] font-medium transition-colors ${
                  isActive ? 'text-[#14b8a6]' : 'text-gray-400'
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