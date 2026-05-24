interface AppLogoProps {
  className?: string;
}

export default function AppLogo({ className = 'w-10 h-10' }: AppLogoProps) {
  return (
    <div className={`relative ${className}`}>
      <img
        src="/assets/logo-dark.png"
        alt="AmanahLife"
        className="absolute inset-0 w-full h-full object-contain transition-opacity duration-300 dark:opacity-100 opacity-0"
      />
      <img
        src="/assets/logo-light.png"
        alt="AmanahLife"
        className="absolute inset-0 w-full h-full object-contain transition-opacity duration-300 dark:opacity-0 opacity-100"
      />
    </div>
  );
}