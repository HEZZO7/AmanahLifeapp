import { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import BottomNav from '@/components/BottomNav';
import { useNavigate } from 'react-router-dom';

interface Bill {
  id: string;
  name: string;
  amount: number;
  dueDate: string;
  frequency: 'monthly' | 'weekly' | 'yearly';
  category: string;
  isPaid: boolean;
  paidDate?: string;
  createdAt: string;
}

const STORAGE_KEY = 'amanah-bills';

export default function BillReminders() {
  const { language, isRTL } = useLanguage();
  const navigate = useNavigate();
  const [bills, setBills] = useState<Bill[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [frequency, setFrequency] = useState<'monthly' | 'weekly' | 'yearly'>('monthly');
  const [category, setCategory] = useState('utilities');
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setBills(JSON.parse(saved));
  }, []);

  const saveBills = (updated: Bill[]) => {
    setBills(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const handleAdd = () => {
    if (!name.trim() || !amount || !dueDate) return;
    const newBill: Bill = {
      id: Date.now().toString(),
      name: name.trim(),
      amount: Number(amount),
      dueDate,
      frequency,
      category,
      isPaid: false,
      createdAt: new Date().toISOString(),
    };
    saveBills([...bills, newBill]);
    setName('');
    setAmount('');
    setDueDate('');
    setShowForm(false);
  };

  const markPaid = (id: string) => {
    saveBills(bills.map(b =>
      b.id === id ? { ...b, isPaid: true, paidDate: new Date().toISOString() } : b
    ));
  };

  const deleteBill = (id: string) => {
    saveBills(bills.filter(b => b.id !== id));
  };

  const getDaysUntilDue = (dateStr: string) => {
    const due = new Date(dateStr);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

  const upcomingBills = useMemo(() => {
    return bills
      .filter(b => !b.isPaid)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [bills]);

  const paidBills = useMemo(() => {
    return bills
      .filter(b => b.isPaid)
      .sort((a, b) => new Date(b.paidDate || b.dueDate).getTime() - new Date(a.paidDate || a.dueDate).getTime());
  }, [bills]);

  const monthlyTotal = useMemo(() => {
    return upcomingBills.reduce((sum, b) => sum + b.amount, 0);
  }, [upcomingBills]);

  const categories = [
    { value: 'utilities', label: language === 'ar' ? 'مرافق' : 'Utilities' },
    { value: 'rent', label: language === 'ar' ? 'إيجار' : 'Rent' },
    { value: 'insurance', label: language === 'ar' ? 'تأمين' : 'Insurance' },
    { value: 'subscription', label: language === 'ar' ? 'اشتراكات' : 'Subscriptions' },
    { value: 'phone', label: language === 'ar' ? 'هاتف' : 'Phone' },
    { value: 'internet', label: language === 'ar' ? 'إنترنت' : 'Internet' },
    { value: 'other', label: language === 'ar' ? 'أخرى' : 'Other' },
  ];

  const getCategoryIcon = (cat: string) => {
    const icons: Record<string, string> = {
      utilities: '💡', rent: '🏠', insurance: '🛡️',
      subscription: '📱', phone: '📞', internet: '🌐', other: '📋',
    };
    return icons[cat] || '📋';
  };

  return (
    <div className="min-h-screen bg-background pb-20" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="text-muted-foreground hover:text-foreground">
              {isRTL ? '→' : '←'}
            </button>
            <h1 className="text-xl font-bold text-foreground">
              {language === 'ar' ? '🔔 تذكير الفواتير' : '🔔 Bill Reminders'}
            </h1>
          </div>
          <Button size="sm" onClick={() => setShowForm(true)}>
            {language === 'ar' ? '+ فاتورة' : '+ Bill'}
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Monthly Total */}
        <Card className="p-4 bg-gradient-to-r from-primary/20 to-[#D4A017]/20 border-primary/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">
                {language === 'ar' ? 'إجمالي الفواتير القادمة' : 'Total Upcoming Bills'}
              </p>
              <p className="text-2xl font-bold text-foreground mt-1">{monthlyTotal}</p>
            </div>
            <div className="text-3xl">💳</div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {upcomingBills.length} {language === 'ar' ? 'فاتورة معلقة' : 'bills pending'}
          </p>
        </Card>

        {/* Add Bill Form */}
        {showForm && (
          <Card className="p-4 border-primary/30">
            <h3 className="font-semibold text-foreground mb-3">
              {language === 'ar' ? 'إضافة فاتورة جديدة' : 'Add New Bill'}
            </h3>
            <div className="space-y-3">
              <input
                type="text"
                placeholder={language === 'ar' ? 'اسم الفاتورة' : 'Bill name'}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm"
              />
              <input
                type="number"
                placeholder={language === 'ar' ? 'المبلغ' : 'Amount'}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm"
              />
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm"
              />
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as 'monthly' | 'weekly' | 'yearly')}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm"
              >
                <option value="weekly">{language === 'ar' ? 'أسبوعي' : 'Weekly'}</option>
                <option value="monthly">{language === 'ar' ? 'شهري' : 'Monthly'}</option>
                <option value="yearly">{language === 'ar' ? 'سنوي' : 'Yearly'}</option>
              </select>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm"
              >
                {categories.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAdd}>
                  {language === 'ar' ? 'إضافة' : 'Add Bill'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Upcoming Bills */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3">
            {language === 'ar' ? '📋 الفواتير القادمة' : '📋 Upcoming Bills'}
          </h2>
          <div className="space-y-2">
            {upcomingBills.map(bill => {
              const daysLeft = getDaysUntilDue(bill.dueDate);
              const isDueSoon = daysLeft <= 3 && daysLeft >= 0;
              const isOverdue = daysLeft < 0;
              return (
                <Card key={bill.id} className={`p-4 ${isDueSoon ? 'border-amber-500/50' : isOverdue ? 'border-red-500/50' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{getCategoryIcon(bill.category)}</span>
                      <div>
                        <p className="font-medium text-foreground">{bill.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {bill.dueDate} • {language === 'ar'
                            ? bill.frequency === 'monthly' ? 'شهري' : bill.frequency === 'weekly' ? 'أسبوعي' : 'سنوي'
                            : bill.frequency}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-foreground">{bill.amount}</p>
                      {isDueSoon && (
                        <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">
                          {language === 'ar' ? `${daysLeft} أيام` : `${daysLeft}d left`}
                        </span>
                      )}
                      {isOverdue && (
                        <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
                          {language === 'ar' ? 'متأخر' : 'Overdue'}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="outline" className="text-xs" onClick={() => markPaid(bill.id)}>
                      ✓ {language === 'ar' ? 'تم الدفع' : 'Mark Paid'}
                    </Button>
                    <Button size="sm" variant="ghost" className="text-xs text-red-400" onClick={() => deleteBill(bill.id)}>
                      {language === 'ar' ? 'حذف' : 'Delete'}
                    </Button>
                  </div>
                </Card>
              );
            })}
            {upcomingBills.length === 0 && (
              <div className="text-center py-8">
                <p className="text-3xl mb-2">🎉</p>
                <p className="text-muted-foreground">
                  {language === 'ar' ? 'لا توجد فواتير معلقة' : 'No pending bills'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Payment History */}
        <div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 text-lg font-semibold text-foreground mb-3"
          >
            <span>{language === 'ar' ? '📜 سجل المدفوعات' : '📜 Payment History'}</span>
            <span className="text-xs text-muted-foreground">({paidBills.length})</span>
            <span className="text-xs">{showHistory ? '▲' : '▼'}</span>
          </button>
          {showHistory && (
            <div className="space-y-2">
              {paidBills.map(bill => (
                <Card key={bill.id} className="p-3 opacity-70">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span>{getCategoryIcon(bill.category)}</span>
                      <div>
                        <p className="text-sm text-foreground">{bill.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {language === 'ar' ? 'تم الدفع' : 'Paid'}: {bill.paidDate ? new Date(bill.paidDate).toLocaleDateString() : '-'}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm font-medium text-primary">{bill.amount} ✓</p>
                  </div>
                </Card>
              ))}
              {paidBills.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-4">
                  {language === 'ar' ? 'لا يوجد سجل بعد' : 'No payment history yet'}
                </p>
              )}
            </div>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}