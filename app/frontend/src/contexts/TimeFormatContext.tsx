import { createContext, useContext, useState, ReactNode } from 'react';
import { TimeFormat, formatClockTime, detectDefaultTimeFormat } from '@/lib/time';

interface TimeFormatContextType {
  timeFormat: TimeFormat;
  setTimeFormat: (format: TimeFormat) => void;
  formatTime: (hhmm: string) => string;
}

const TimeFormatContext = createContext<TimeFormatContextType | undefined>(undefined);

export function TimeFormatProvider({ children }: { children: ReactNode }) {
  const [timeFormat, setTimeFormatState] = useState<TimeFormat>(() => {
    const stored = localStorage.getItem('amanah_time_format');
    if (stored === '12h' || stored === '24h') return stored;
    const detected = detectDefaultTimeFormat();
    localStorage.setItem('amanah_time_format', detected);
    return detected;
  });

  const setTimeFormat = (format: TimeFormat) => {
    setTimeFormatState(format);
    localStorage.setItem('amanah_time_format', format);
  };

  const formatTime = (hhmm: string) => formatClockTime(hhmm, timeFormat);

  return (
    <TimeFormatContext.Provider value={{ timeFormat, setTimeFormat, formatTime }}>
      {children}
    </TimeFormatContext.Provider>
  );
}

export function useTimeFormat() {
  const context = useContext(TimeFormatContext);
  if (context === undefined) {
    return {
      timeFormat: '24h' as TimeFormat,
      setTimeFormat: () => {},
      formatTime: (hhmm: string) => formatClockTime(hhmm, '24h'),
    };
  }
  return context;
}
