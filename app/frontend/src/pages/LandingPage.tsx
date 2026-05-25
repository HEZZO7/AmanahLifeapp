import { useEffect } from 'react';

export default function LandingPage() {
  useEffect(() => {
    // Hide any app chrome when showing landing page
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <iframe
      src="/landing.html"
      title="AmanahLife Landing"
      style={{
        width: '100vw',
        height: '100vh',
        border: 'none',
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 9999,
      }}
    />
  );
}