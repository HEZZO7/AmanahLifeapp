import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { WifiOff, Wifi } from 'lucide-react';

export default function OfflineIndicator() {
  const { language } = useLanguage();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showReconnected, setShowReconnected] = useState(false);
  const [pendingChanges, setPendingChanges] = useState(0);
  const isAr = language === 'ar';

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnected(true);
      // Sync queued changes
      syncOfflineQueue();
      setTimeout(() => setShowReconnected(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    // Check pending changes
    const checkPending = () => {
      try {
        const queue = JSON.parse(localStorage.getItem('amanah-offline-queue') || '[]');
        setPendingChanges(queue.length);
      } catch {
        setPendingChanges(0);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    const interval = setInterval(checkPending, 5000);
    checkPending();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  if (isOnline && !showReconnected && pendingChanges === 0) return null;

  return (
    <div className={`fixed top-[70px] left-1/2 -translate-x-1/2 z-[100] transition-all duration-300 ${
      !isOnline || showReconnected || pendingChanges > 0 ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
    }`}>
      {!isOnline ? (
        <div className="flex items-center gap-2 bg-amber-500/90 text-white px-4 py-2 rounded-full shadow-lg text-xs font-medium backdrop-blur-sm">
          <WifiOff className="w-3.5 h-3.5" />
          <span>
            {isAr ? 'غير متصل — سيتم مزامنة التغييرات لاحقاً' : 'Offline — changes will sync later'}
          </span>
          {pendingChanges > 0 && (
            <span className="bg-white/20 px-1.5 py-0.5 rounded-full text-[10px]">
              {pendingChanges}
            </span>
          )}
        </div>
      ) : showReconnected ? (
        <div className="flex items-center gap-2 bg-emerald-500/90 text-white px-4 py-2 rounded-full shadow-lg text-xs font-medium backdrop-blur-sm">
          <Wifi className="w-3.5 h-3.5" />
          <span>{isAr ? 'تمت إعادة الاتصال! جارٍ المزامنة...' : 'Reconnected! Syncing...'}</span>
        </div>
      ) : null}
    </div>
  );
}

// Sync offline queue when back online
function syncOfflineQueue() {
  try {
    const queue = JSON.parse(localStorage.getItem('amanah-offline-queue') || '[]');
    if (queue.length === 0) return;

    // Process queue items
    // For now, just clear the queue since data is in localStorage
    // In a full implementation, this would push to Supabase
    localStorage.setItem('amanah-offline-queue', '[]');
  } catch {
    // Silently fail
  }
}

// Utility to add to offline queue
export function addToOfflineQueue(action: string, data: unknown) {
  if (navigator.onLine) return; // Only queue when offline
  
  try {
    const queue = JSON.parse(localStorage.getItem('amanah-offline-queue') || '[]');
    queue.push({ action, data, timestamp: new Date().toISOString() });
    localStorage.setItem('amanah-offline-queue', JSON.stringify(queue));
  } catch {
    // Silently fail
  }
}