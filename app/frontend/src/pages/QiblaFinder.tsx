import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import BottomNav from '@/components/BottomNav';

export default function QiblaFinder() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [qiblaDirection, setQiblaDirection] = useState<number | null>(null);
  const [compassHeading, setCompassHeading] = useState(0);
  const [locationName, setLocationName] = useState('Detecting...');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !user) navigate('/login');
  }, [user, authLoading, navigate]);

  const calculateQibla = useCallback((lat: number, lng: number) => {
    // Kaaba coordinates
    const kaabaLat = 21.4225;
    const kaabaLng = 39.8262;

    const latRad = (lat * Math.PI) / 180;
    const lngRad = (lng * Math.PI) / 180;
    const kaabaLatRad = (kaabaLat * Math.PI) / 180;
    const kaabaLngRad = (kaabaLng * Math.PI) / 180;

    const dLng = kaabaLngRad - lngRad;
    const x = Math.sin(dLng);
    const y = Math.cos(latRad) * Math.tan(kaabaLatRad) - Math.sin(latRad) * Math.cos(dLng);
    let qibla = (Math.atan2(x, y) * 180) / Math.PI;
    if (qibla < 0) qibla += 360;

    setQiblaDirection(Math.round(qibla));
  }, []);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          calculateQibla(pos.coords.latitude, pos.coords.longitude);
          setLocationName(`${pos.coords.latitude.toFixed(4)}°N, ${pos.coords.longitude.toFixed(4)}°E`);
        },
        () => {
          setError('Location access denied. Please enable location services.');
          // Default to a common location
          calculateQibla(40.7128, -74.006);
          setLocationName('New York (default)');
          toast.info('Using default location. Enable GPS for accurate direction.');
        }
      );
    } else {
      setError('Geolocation not supported');
    }
  }, [calculateQibla]);

  // Device orientation for compass
  useEffect(() => {
    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (event.alpha !== null) {
        setCompassHeading(event.alpha);
      }
    };

    if (typeof DeviceOrientationEvent !== 'undefined') {
      window.addEventListener('deviceorientation', handleOrientation);
    }

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, []);

  const rotation = qiblaDirection !== null ? qiblaDirection - compassHeading : 0;

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 pb-20">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 flex items-center justify-between h-14">
          <div className="w-16" />
          <h1 className="text-lg font-bold text-gray-900">🧭 Qibla Finder</h1>
          <div className="w-16" />
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-8 space-y-6">
        {error && (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm text-center">
            {error}
          </div>
        )}

        {/* Location */}
        <p className="text-sm text-gray-500 text-center">📍 {locationName}</p>

        {/* Compass */}
        <div className="flex justify-center">
          <div className="relative w-72 h-72">
            {/* Outer ring */}
            <div className="absolute inset-0 rounded-full border-4 border-gray-200 shadow-inner" />

            {/* Compass markings */}
            <div
              className="absolute inset-2 rounded-full transition-transform duration-300 ease-out"
              style={{ transform: `rotate(${-compassHeading}deg)` }}
            >
              {/* N/S/E/W markers */}
              <span className="absolute top-2 left-1/2 -translate-x-1/2 text-sm font-bold text-red-500">N</span>
              <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-sm font-bold text-gray-400">S</span>
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">E</span>
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">W</span>

              {/* Degree ticks */}
              {Array.from({ length: 36 }).map((_, i) => (
                <div
                  key={i}
                  className="absolute top-0 left-1/2 h-full w-px origin-bottom"
                  style={{ transform: `rotate(${i * 10}deg) translateX(-50%)` }}
                >
                  <div className={`w-px ${i % 9 === 0 ? 'h-4 bg-gray-400' : 'h-2 bg-gray-200'}`} />
                </div>
              ))}
            </div>

            {/* Qibla Arrow */}
            <div
              className="absolute inset-4 flex items-center justify-center transition-transform duration-500 ease-out"
              style={{ transform: `rotate(${rotation}deg)` }}
            >
              <div className="relative w-full h-full flex items-center justify-center">
                {/* Arrow pointing up (toward Qibla) */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-b-[80px] border-b-emerald-500 drop-shadow-md" />
                {/* Arrow tail */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-2 h-16 bg-emerald-300 rounded-full" />
                {/* Kaaba icon at tip */}
                <div className="absolute top-1 left-1/2 -translate-x-1/2 text-lg">🕋</div>
              </div>
            </div>

            {/* Center dot */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-4 h-4 rounded-full bg-emerald-600 border-2 border-white shadow-md" />
            </div>
          </div>
        </div>

        {/* Direction Info */}
        <Card className="border-0 shadow-lg">
          <CardContent className="p-6 text-center space-y-2">
            <p className="text-sm text-gray-500">Qibla Direction</p>
            <p className="text-4xl font-bold text-emerald-600">
              {qiblaDirection !== null ? `${qiblaDirection}°` : '...'}
            </p>
            <p className="text-xs text-gray-400">from North (clockwise)</p>
          </CardContent>
        </Card>

        {/* Instructions */}
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
          <h3 className="font-semibold text-emerald-800 text-sm mb-2">How to use:</h3>
          <ul className="text-xs text-emerald-700 space-y-1">
            <li>• Hold your device flat and level</li>
            <li>• The green arrow points toward the Kaaba</li>
            <li>• On desktop, the direction angle is shown below</li>
            <li>• For best results, calibrate your compass by moving your phone in a figure-8 pattern</li>
          </ul>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}