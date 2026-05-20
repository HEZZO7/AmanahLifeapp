import { useState, useEffect, useCallback } from 'react';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { supabase } from '@/lib/supabase';

const FIRST_USE_KEY = 'amanahlife_first_use';
const DISMISSED_KEY = 'amanahlife_promo_dismissed';
const COUPON_CODE = 'AMANAH30';
const EDGE_FUNCTION_URL = 'https://nyhsnvjdgifphwkqzwel.supabase.co/functions/v1/app_11941c8fec_stripe_coupon_checkout';
const DAYS_BEFORE_SHOW = 7;
const DAYS_BEFORE_RESHOW = 3;

export default function PromoBanner() {
  const { tier } = useSubscription();
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);

  useEffect(() => {
    // Set first-use timestamp if not present
    if (!localStorage.getItem(FIRST_USE_KEY)) {
      localStorage.setItem(FIRST_USE_KEY, Date.now().toString());
    }

    // Only show for free-tier users
    if (tier !== 'free') {
      setVisible(false);
      return;
    }

    // Check if 7 days have passed since first use
    const firstUse = parseInt(localStorage.getItem(FIRST_USE_KEY) || '0', 10);
    const daysSinceFirstUse = (Date.now() - firstUse) / (1000 * 60 * 60 * 24);
    if (daysSinceFirstUse < DAYS_BEFORE_SHOW) {
      setVisible(false);
      return;
    }

    // Check dismissal
    const dismissedAt = localStorage.getItem(DISMISSED_KEY);
    if (dismissedAt) {
      const daysSinceDismissed = (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < DAYS_BEFORE_RESHOW) {
        setVisible(false);
        return;
      }
    }

    setVisible(true);
    // Trigger entrance animation after a brief delay
    setTimeout(() => setAnimateIn(true), 50);
  }, [tier]);

  const handleDismiss = useCallback(() => {
    localStorage.setItem(DISMISSED_KEY, Date.now().toString());
    setAnimateIn(false);
    setTimeout(() => setVisible(false), 300);
  }, []);

  const handleCopyCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(COUPON_CODE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = COUPON_CODE;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, []);

  const handleSubscribe = useCallback(async () => {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await fetch(EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tier: 'balanced',
          billing: 'monthly',
          couponCode: COUPON_CODE,
          successUrl: `${window.location.origin}/settings?subscription=success`,
          cancelUrl: `${window.location.origin}/subscription`,
        }),
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-[#c9a96e]/40 mb-4 transition-all duration-300 ${
        animateIn ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
      }`}
      style={{
        background: 'linear-gradient(135deg, #0a2e1f 0%, #134e3a 50%, #0f3d2e 100%)',
      }}
    >
      {/* Animated glow effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] animate-spin"
          style={{
            background: 'conic-gradient(from 0deg, transparent, rgba(201, 169, 110, 0.1), transparent, rgba(20, 184, 166, 0.1), transparent)',
            animationDuration: '8s',
          }}
        />
      </div>

      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        className="absolute top-3 left-3 z-10 w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
        aria-label="Dismiss"
      >
        <svg className="w-4 h-4 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Content */}
      <div className="relative z-[1] p-5 text-center">
        <p className="text-2xl mb-2">🎉</p>
        <h3 className="text-lg font-bold text-white font-arabic leading-relaxed">
          عرض خاص! خصم 30% على أول شهر اشتراك
        </h3>
        <p className="text-sm text-teal-200/80 mt-1">
          Use code <span className="font-bold text-[#c9a96e]">AMANAH30</span> for 30% off your first month
        </p>

        {/* Coupon code badge */}
        <div className="mt-3 flex items-center justify-center gap-2">
          <button
            onClick={handleCopyCode}
            className="inline-flex items-center gap-2 bg-[#c9a96e]/20 border border-[#c9a96e]/50 rounded-lg px-4 py-2 hover:bg-[#c9a96e]/30 transition-colors"
          >
            <span className="text-[#c9a96e] font-mono font-bold text-lg tracking-wider">
              {COUPON_CODE}
            </span>
            <svg className="w-4 h-4 text-[#c9a96e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {copied ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              )}
            </svg>
          </button>
          {copied && (
            <span className="text-xs text-teal-300 animate-pulse">تم النسخ!</span>
          )}
        </div>

        {/* CTA Button */}
        <button
          onClick={handleSubscribe}
          disabled={loading}
          className="mt-4 w-full max-w-xs mx-auto block bg-gradient-to-r from-[#c9a96e] to-[#d4b87a] text-[#0a2e1f] font-bold py-3 px-6 rounded-xl hover:from-[#d4b87a] hover:to-[#e0c88f] transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              جاري التحميل...
            </span>
          ) : (
            'اشترك الآن بخصم 🚀'
          )}
        </button>
      </div>
    </div>
  );
}