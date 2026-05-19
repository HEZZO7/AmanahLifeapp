import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import BottomNav from '@/components/BottomNav';

type TransactionType = 'income' | 'expense';
type IncomeCategory = 'salary' | 'freelance' | 'investment' | 'gift' | 'other';

interface Transaction {
  id: string;
  type: TransactionType;
  category: IncomeCategory;
  amount: number;
  description: string;
  date: string;
}

const CATEGORY_ICONS: Record<IncomeCategory, string> = {
  salary: '💰',
  freelance: '💻',
  investment: '📈',
  gift: '🎁',
  other: '📦',
};

export default function Finance() {
  const { t } = useLanguage();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<TransactionType>('income');
  const [category, setCategory] = useState<IncomeCategory>('salary');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('amanah_finance');
    if (stored) setTransactions(JSON.parse(stored));
  }, []);

  const saveTransactions = (updated: Transaction[]) => {
    setTransactions(updated);
    localStorage.setItem('amanah_finance', JSON.stringify(updated));
  };

  const addTransaction = () => {
    if (!amount || parseFloat(amount) <= 0) return;
    const newTx: Transaction = {
      id: Date.now().toString(),
      type,
      category,
      amount: parseFloat(amount),
      description: description.trim() || t(category),
      date: new Date().toISOString(),
    };
    saveTransactions([newTx, ...transactions]);
    setAmount('');
    setDescription('');
    setShowForm(false);
  };

  const deleteTransaction = (id: string) => {
    saveTransactions(transactions.filter((tx) => tx.id !== id));
  };

  // Monthly calculations
  const now = new Date();
  const monthTransactions = transactions.filter((tx) => {
    const d = new Date(tx.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const monthlyIncome = monthTransactions
    .filter((tx) => tx.type === 'income')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const monthlyExpense = monthTransactions
    .filter((tx) => tx.type === 'expense')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const savingsRate = monthlyIncome > 0 ? Math.round(((monthlyIncome - monthlyExpense) / monthlyIncome) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#0a2e1f] pb-20">
      <header className="sticky top-0 z-50 bg-[#0a2e1f]/95 backdrop-blur-sm border-b border-[#1a4d35] px-4 py-4">
        <h1 className="text-xl font-bold text-white">{t('finance')}</h1>
      </header>

      <div className="px-4 py-4 space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[#0f3d2a] rounded-2xl p-3 border border-[#1a4d35] text-center">
            <p className="text-[10px] text-gray-400">{t('monthlyIncome')}</p>
            <p className="text-lg font-bold text-[#14b8a6]">${monthlyIncome.toFixed(0)}</p>
          </div>
          <div className="bg-[#0f3d2a] rounded-2xl p-3 border border-[#1a4d35] text-center">
            <p className="text-[10px] text-gray-400">{t('monthlyExpense')}</p>
            <p className="text-lg font-bold text-red-400">${monthlyExpense.toFixed(0)}</p>
          </div>
          <div className="bg-[#0f3d2a] rounded-2xl p-3 border border-[#1a4d35] text-center">
            <p className="text-[10px] text-gray-400">{t('savingsRate')}</p>
            <p className="text-lg font-bold text-[#d4a853]">{savingsRate}%</p>
          </div>
        </div>

        {/* Savings Rate Visual */}
        <div className="bg-[#0f3d2a] rounded-2xl p-4 border border-[#1a4d35]">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-400">{t('savingsRate')}</span>
            <span className="text-sm text-[#d4a853] font-semibold">{savingsRate}%</span>
          </div>
          <div className="w-full h-3 bg-[#1a4d35] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#d4a853] rounded-full transition-all"
              style={{ width: `${Math.max(0, Math.min(100, savingsRate))}%` }}
            />
          </div>
        </div>

        {/* Transactions */}
        <div className="bg-[#0f3d2a] rounded-2xl p-4 border border-[#1a4d35]">
          <h2 className="text-white font-semibold mb-3">{t('transactions')}</h2>
          {transactions.length === 0 && (
            <p className="text-center text-gray-500 py-4 text-sm">No transactions yet</p>
          )}
          <div className="space-y-2 max-h-80 overflow-y-auto scrollbar-hide">
            {transactions.slice(0, 20).map((tx) => (
              <div key={tx.id} className="flex items-center justify-between p-2 rounded-xl bg-[#0a2e1f]">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{CATEGORY_ICONS[tx.category]}</span>
                  <div>
                    <p className="text-white text-sm">{tx.description}</p>
                    <p className="text-gray-500 text-[10px]">
                      {new Date(tx.date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-semibold ${tx.type === 'income' ? 'text-[#14b8a6]' : 'text-red-400'}`}>
                    {tx.type === 'income' ? '+' : '-'}${tx.amount.toFixed(0)}
                  </span>
                  <button onClick={() => deleteTransaction(tx.id)} className="text-gray-600 hover:text-red-400 text-xs">✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add Transaction Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end">
          <div className="w-full bg-[#0f3d2a] rounded-t-3xl p-6 space-y-4">
            <h3 className="text-white font-semibold text-lg">{t('addTransaction')}</h3>

            {/* Type Toggle */}
            <div className="flex gap-2">
              <button
                onClick={() => setType('income')}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
                  type === 'income' ? 'bg-[#14b8a6] text-white' : 'bg-[#1a4d35] text-gray-400'
                }`}
              >
                {t('income')}
              </button>
              <button
                onClick={() => setType('expense')}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
                  type === 'expense' ? 'bg-red-500 text-white' : 'bg-[#1a4d35] text-gray-400'
                }`}
              >
                {t('expense')}
              </button>
            </div>

            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={t('amount')}
              className="w-full p-3 rounded-xl bg-[#1a4d35] text-white placeholder-gray-500 border border-[#1a4d35] focus:border-[#14b8a6] outline-none"
            />

            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('description')}
              className="w-full p-3 rounded-xl bg-[#1a4d35] text-white placeholder-gray-500 border border-[#1a4d35] focus:border-[#14b8a6] outline-none"
            />

            <div>
              <p className="text-gray-400 text-sm mb-2">{t('category')}</p>
              <div className="flex flex-wrap gap-2">
                {(['salary', 'freelance', 'investment', 'gift', 'other'] as IncomeCategory[]).map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    className={`px-3 py-1.5 rounded-full text-xs transition-all ${
                      category === c
                        ? 'bg-[#d4a853] text-white'
                        : 'bg-[#1a4d35] text-gray-400'
                    }`}
                  >
                    {CATEGORY_ICONS[c]} {t(c)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 p-3 rounded-xl bg-[#1a4d35] text-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={addTransaction}
                className="flex-1 p-3 rounded-xl bg-[#14b8a6] text-white font-semibold"
              >
                {t('addTransaction')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setShowForm(true)}
        className="fixed bottom-24 right-4 w-14 h-14 rounded-full bg-[#14b8a6] text-white text-2xl shadow-lg flex items-center justify-center hover:bg-[#0d9488] active:scale-90 transition-all z-40"
      >
        +
      </button>

      <BottomNav />
    </div>
  );
}