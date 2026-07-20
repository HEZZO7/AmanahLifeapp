import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Blog pages are prerendered to static HTML for SEO (crawlers get instant
// content), but React still mounts on top afterward so they inherit the
// user's live theme/language state exactly like every other route —
// otherwise they're stuck showing whatever the build-time default was.
createRoot(document.getElementById('root')!).render(<App />);
