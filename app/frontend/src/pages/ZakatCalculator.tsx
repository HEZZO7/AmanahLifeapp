import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import BottomNav from '@/components/BottomNav';

interface ZakatItem {
  label: string;
  value: string;
  key: string;
  icon: string;
}

// Current approximate Nisab values (updated periodically)
const GOLD_PRICE_PER_GRAM = 75; // USD approximate
const SILVER_PRICE_PER_GRAM = 0.95; // USD approximate
const NISAB_GOLD_GRAMS = 87.48; // 7.5 tola
const NISAB_SILVER_GRAMS = 612.36; // 52.5 tola
const ZAKAT_RATE = 0.025; // 2.5%

export default function ZakatCalculator() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [assets, setAssets] = useState<ZakatItem[]>([
    { label: 'Cash & Bank Balance', value: '', key: 'cash', icon: '💵' },
    { label: 'Gold (in grams)', value: '', key: 'gold', icon: '🪙' },
    { label: 'Silver (in grams)', value: '', key: 'silver', icon: '🥈' },
    { label: 'Investments & Stocks', value: '', key: 'investments', icon: '📈' },
    { label: 'Business Inventory', value: '', key: 'business', icon: '🏪' },
    { label: 'Rental Income', value: '', key: 'rental', icon: '🏠' },
    { label: 'Other Assets', value: '', key: 'other', icon: '💎' },
  ]);
  const [liabilities, setLiabilities] = useState('');
  const [calculated, setCalculated] = useState(false);
  const [currency, setCurrency] = useState('USD');

  useEffect(() => {
    if (!authLoading && !user) navigate('/login');
  }, [user, authLoading, navigate]);

  const updateAsset = (key: string, value: string) => {
    setAssets((prev) => prev.map((a) => (a.key === key ? { ...a, value } : a)));
    setCalculated(false);
  };

  const calculateTotal = () => {
    let total = 0;
    assets.forEach((asset) => {
      const val = parseFloat(asset.value) || 0;
      if (asset.key === 'gold') {
        total += val * GOLD_PRICE_PER_GRAM;
      } else if (asset.key === 'silver') {
        total += val * SILVER_PRICE_PER_GRAM;
      } else {
        total += val;
      }
    });
    return total;
  };

  const totalAssets = calculateTotal();
  const totalLiabilities = parseFloat(liabilities) || 0;
  const netWorth = totalAssets - totalLiabilities;
  const nisabGold = NISAB_GOLD_GRAMS * GOLD_PRICE_PER_GRAM;
  const nisabSilver = NISAB_SILVER_GRAMS * SILVER_PRICE_PER_GRAM;
  const nisab = Math.min(nisabGold, nisabSilver);
  const isEligible = netWorth >= nisab;
  const zakatAmount = isEligible ? netWorth * ZAKAT_RATE : 0;

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 flex items-center justify-between h-14">
          <div className="w-16" />
          <h1 className="text-lg font-bold text-foreground">💰 Zakat Calculator</h1>
          <div className="w-16" />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Nisab Info */}
        <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-emerald-600 dark:text-emerald-300 font-medium">Current Nisab Threshold</p>
                <p className="text-lg font-bold text-emerald-800 dark:text-emerald-100">${nisab.toFixed(2)} {currency}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Gold: {NISAB_GOLD_GRAMS}g</p>
                <p className="text-xs text-muted-foreground">Silver: {NISAB_SILVER_GRAMS}g</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Currency Selector */}
        <div className="flex gap-2">
          {['USD', 'GBP', 'EUR', 'SAR'].map((c) => (
            <Button
              key={c}
              size="sm"
              variant={currency === c ? 'default' : 'outline'}
              className={currency === c ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'text-foreground'}
              onClick={() => setCurrency(c)}
            >
              {c}
            </Button>
          ))}
        </div>

        {/* Assets Input */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-foreground">Your Assets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {assets.map((asset) => (
              <div key={asset.key} className="flex items-center gap-3">
                <span className="text-xl w-8">{asset.icon}</span>
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground block mb-1">{asset.label}</label>
                  <Input
                    type="number"
                    placeholder={asset.key === 'gold' || asset.key === 'silver' ? 'grams' : `${currency}`}
                    value={asset.value}
                    onChange={(e) => updateAsset(asset.key, e.target.value)}
                    className="bg-secondary"
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Liabilities */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-foreground">Deductions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <span className="text-xl w-8">📋</span>
              <div className="flex-1">
                <label className="text-xs text-muted-foreground block mb-1">Outstanding Debts & Liabilities</label>
                <Input
                  type="number"
                  placeholder={currency}
                  value={liabilities}
                  onChange={(e) => { setLiabilities(e.target.value); setCalculated(false); }}
                  className="bg-secondary"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Calculate Button */}
        <Button
          className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 text-base font-semibold"
          onClick={() => setCalculated(true)}
        >
          Calculate Zakat
        </Button>

        {/* Results */}
        {calculated && (
          <Card className="border-0 shadow-xl overflow-hidden">
            <div className={`p-6 text-center ${isEligible ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-gradient-to-br from-gray-500 to-gray-600'} text-white`}>
              <p className="text-sm opacity-80">Your Zakat Due</p>
              <p className="text-4xl font-bold mt-2">
                {isEligible ? `$${zakatAmount.toFixed(2)}` : '$0.00'}
              </p>
              <p className="text-xs opacity-70 mt-2">
                {isEligible ? '2.5% of your net zakatable wealth' : 'Below Nisab threshold - no Zakat due'}
              </p>
            </div>
            <CardContent className="p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Assets</span>
                <span className="font-medium text-foreground">${totalAssets.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Liabilities</span>
                <span className="font-medium text-red-500 dark:text-red-400">-${totalLiabilities.toFixed(2)}</span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between text-sm">
                <span className="text-muted-foreground">Net Zakatable Wealth</span>
                <span className="font-bold text-foreground">${netWorth.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Nisab Threshold</span>
                <span className={`font-medium ${isEligible ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                  ${nisab.toFixed(2)} {isEligible ? '✓' : ''}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Info */}
        <div className="p-4 rounded-xl bg-secondary border border-border">
          <h3 className="font-semibold text-foreground text-sm mb-2">ℹ️ About Zakat</h3>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• Zakat is 2.5% of wealth held for one lunar year above Nisab</li>
            <li>• Nisab is the minimum amount that makes one liable for Zakat</li>
            <li>• Gold prices are approximate — consult current market rates</li>
            <li>• Consult a scholar for specific rulings on your situation</li>
          </ul>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}