import { useNavigate } from 'react-router-dom';

interface PageHeaderProps {
  icon: string;
  title: string;
}

export default function PageHeader({ icon, title }: PageHeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center h-16 gap-3">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full bg-card flex items-center justify-center border border-border"
        >
          <svg className="w-5 h-5 text-foreground rtl:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-foreground">
          {icon} {title}
        </h1>
      </div>
    </header>
  );
}