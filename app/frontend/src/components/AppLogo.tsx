import { useTheme } from '@/contexts/ThemeContext';

interface AppLogoProps {
  className?: string;
}

export default function AppLogo({ className = 'w-10 h-10' }: AppLogoProps) {
  const { theme } = useTheme();

  return (
    <div className={`relative ${className}`}>
      <img
        src="/assets/logo-dark.png"
        alt="AmanahLife"
        className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-300 ${
          theme === 'dark' ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <img
        src="/assets/logo-light.png"
        alt="AmanahLife"
        className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-300 ${
          theme === 'light' ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
}