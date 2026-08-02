/**
 * Excused-period (عذر شرعي) management dialog - Phase C, 2026-08-02.
 * Mirrors amanahlife-rn's src/components/ExcusedPeriodsModal.tsx (same
 * disclaimer, same fiqh-driven form, same qada tick-off pattern). Reached
 * via a discreet entry point on PrayerTimes.tsx and FastingTracker.tsx
 * only - no dashboard tile, no notification, nothing on any shared/family
 * view.
 */
import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  ExcusedPeriod, ExcusedReason, EXCUSED_REASON_LABELS, DISCLAIMER_TEXT,
  getExcusedPeriods, addExcusedPeriod, endExcusedPeriod, deleteExcusedPeriod,
  hasSeenDisclaimer, markDisclaimerSeen,
  computeFastingQadaOwed, getFastingQadaMadeUp, adjustFastingQadaMadeUp,
  computePrayerQadaOwed, getPrayerQadaMadeUp, adjustPrayerQadaMadeUp,
  isoDate,
} from '@/lib/excusedPeriods';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const REASONS: ExcusedReason[] = ['menstruation', 'nifas', 'illness', 'travel'];

function daysAgoToIso(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return isoDate(d);
}

function formatIsoForDisplay(iso: string, isAr: boolean): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(isAr ? 'ar' : 'en', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ExcusedPeriodsDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const userId = user?.id ?? null;

  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [periods, setPeriods] = useState<ExcusedPeriod[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);

  const [reason, setReason] = useState<ExcusedReason>('menstruation');
  const [startDaysAgo, setStartDaysAgo] = useState(0);
  const [isOngoing, setIsOngoing] = useState(true);
  const [endDaysAgo, setEndDaysAgo] = useState(0);
  const [illnessIncapacitated, setIllnessIncapacitated] = useState(false);
  const [illnessChoice, setIllnessChoice] = useState<'qada' | 'waived' | null>(null);

  const [fastingOwed, setFastingOwed] = useState(0);
  const [fastingMadeUp, setFastingMadeUp] = useState(0);
  const [prayerOwed, setPrayerOwed] = useState(0);
  const [prayerMadeUp, setPrayerMadeUp] = useState(0);

  const refresh = useCallback(() => {
    setPeriods(getExcusedPeriods(userId).slice().reverse());
    setFastingOwed(computeFastingQadaOwed(userId));
    setFastingMadeUp(getFastingQadaMadeUp(userId));
    setPrayerOwed(computePrayerQadaOwed(userId));
    setPrayerMadeUp(getPrayerQadaMadeUp(userId));
  }, [userId]);

  useEffect(() => {
    if (!open) return;
    setShowDisclaimer(!hasSeenDisclaimer(userId));
    refresh();
  }, [open, userId, refresh]);

  const resetForm = () => {
    setReason('menstruation');
    setStartDaysAgo(0);
    setIsOngoing(true);
    setEndDaysAgo(0);
    setIllnessIncapacitated(false);
    setIllnessChoice(null);
    setShowAddForm(false);
  };

  const acknowledgeDisclaimer = () => {
    markDisclaimerSeen(userId);
    setShowDisclaimer(false);
  };

  const canSave = reason !== 'illness' || !illnessIncapacitated || illnessChoice !== null;

  const handleSave = () => {
    if (!canSave) return;
    addExcusedPeriod(userId, {
      reason,
      startDate: daysAgoToIso(startDaysAgo),
      endDate: isOngoing ? null : daysAgoToIso(Math.min(endDaysAgo, startDaysAgo)),
      illnessIncapacitated: reason === 'illness' ? illnessIncapacitated : undefined,
      illnessPrayerChoice: reason === 'illness' && illnessIncapacitated ? illnessChoice ?? undefined : undefined,
    });
    resetForm();
    refresh();
  };

  const handleEndNow = (id: string) => { endExcusedPeriod(userId, id); refresh(); };
  const handleDelete = (id: string) => { deleteExcusedPeriod(userId, id); refresh(); };
  const bumpFastingMadeUp = (delta: number) => { adjustFastingQadaMadeUp(userId, delta); refresh(); };
  const bumpPrayerMadeUp = (delta: number) => { adjustPrayerQadaMadeUp(userId, delta); refresh(); };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-hidden flex flex-col" dir={isAr ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{isAr ? 'فترة عذر شرعي' : 'Excused Period'}</span>
            <button onClick={() => setShowDisclaimer(true)} className="text-sm" aria-label="info">ℹ️</button>
          </DialogTitle>
        </DialogHeader>

        {showDisclaimer ? (
          <div className="overflow-y-auto">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {isAr ? DISCLAIMER_TEXT.ar : DISCLAIMER_TEXT.en}
            </p>
            <Button className="w-full mt-4 bg-primary hover:bg-primary/90" onClick={acknowledgeDisclaimer}>
              {isAr ? 'فهمت' : 'I understand'}
            </Button>
          </div>
        ) : (
          <div className="overflow-y-auto space-y-4">
            {/* Qada summary */}
            <div className="flex border rounded-xl p-3 gap-4">
              <div className="flex-1 text-center">
                <p className="text-xs text-muted-foreground">{isAr ? 'صيام قضاء متبقٍ' : 'Fasts owed'}</p>
                <p className="text-2xl font-bold text-amber-500 mt-1">{Math.max(0, fastingOwed - fastingMadeUp)}</p>
                <div className="flex gap-2 justify-center mt-2">
                  <button onClick={() => bumpFastingMadeUp(-1)} className="px-2 py-1 rounded bg-secondary text-sm">−</button>
                  <button onClick={() => bumpFastingMadeUp(1)} className="px-2 py-1 rounded bg-primary text-primary-foreground text-xs">+1 {isAr ? 'قُضي' : 'made up'}</button>
                </div>
              </div>
              {prayerOwed > 0 && (
                <div className="flex-1 text-center">
                  <p className="text-xs text-muted-foreground">{isAr ? 'صلوات قضاء متبقية' : 'Prayers owed'}</p>
                  <p className="text-2xl font-bold text-amber-500 mt-1">{Math.max(0, prayerOwed - prayerMadeUp)}</p>
                  <div className="flex gap-2 justify-center mt-2">
                    <button onClick={() => bumpPrayerMadeUp(-1)} className="px-2 py-1 rounded bg-secondary text-sm">−</button>
                    <button onClick={() => bumpPrayerMadeUp(1)} className="px-2 py-1 rounded bg-primary text-primary-foreground text-xs">+1 {isAr ? 'قُضيت' : 'made up'}</button>
                  </div>
                </div>
              )}
            </div>

            {/* Existing periods */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">{isAr ? 'الفترات المسجلة' : 'Recorded periods'}</p>
              {periods.length === 0 && (
                <p className="text-sm text-muted-foreground py-2">{isAr ? 'لا توجد فترات مسجلة' : 'No periods recorded yet'}</p>
              )}
              {periods.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b">
                  <div>
                    <p className="text-sm font-medium text-foreground">{isAr ? EXCUSED_REASON_LABELS[p.reason].ar : EXCUSED_REASON_LABELS[p.reason].en}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatIsoForDisplay(p.startDate, isAr)} - {p.endDate ? formatIsoForDisplay(p.endDate, isAr) : (isAr ? 'مستمرة' : 'ongoing')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!p.endDate && (
                      <button onClick={() => handleEndNow(p.id)} className="text-xs px-2 py-1 rounded border">{isAr ? 'إنهاء الآن' : 'End now'}</button>
                    )}
                    <button onClick={() => handleDelete(p.id)} className="text-red-500">🗑</button>
                  </div>
                </div>
              ))}
            </div>

            {!showAddForm ? (
              <Button className="w-full bg-primary hover:bg-primary/90" onClick={() => setShowAddForm(true)}>
                {isAr ? '+ إضافة فترة جديدة' : '+ Add new period'}
              </Button>
            ) : (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground">{isAr ? 'السبب' : 'Reason'}</p>
                <div className="flex flex-wrap gap-2">
                  {REASONS.map((r) => (
                    <button
                      key={r}
                      onClick={() => { setReason(r); setIllnessIncapacitated(false); setIllnessChoice(null); }}
                      className={`px-3 py-2 rounded-lg border text-sm ${reason === r ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-foreground'}`}
                    >
                      {isAr ? EXCUSED_REASON_LABELS[r].ar : EXCUSED_REASON_LABELS[r].en}
                    </button>
                  ))}
                </div>

                {reason === 'illness' && (
                  <>
                    <button
                      onClick={() => { setIllnessIncapacitated((v) => !v); setIllnessChoice(null); }}
                      className="flex items-start gap-2 text-left w-full"
                    >
                      <span>{illnessIncapacitated ? '☑️' : '⬜'}</span>
                      <span className="text-sm text-foreground">
                        {isAr
                          ? 'كنت عاجزاً تماماً عن أداء الصلاة خلال هذه الفترة (وليس مجرد قصر أو جمع الصلوات)'
                          : 'I was genuinely unable to pray at all during this period (not just shortening/combining)'}
                      </span>
                    </button>
                    {illnessIncapacitated && (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">{isAr ? 'هل ستقضي هذه الصلوات لاحقاً؟' : 'Will you make up these prayers later?'}</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setIllnessChoice('qada')}
                            className={`flex-1 px-3 py-2 rounded-lg border text-sm ${illnessChoice === 'qada' ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-foreground'}`}
                          >
                            {isAr ? 'قضاء' : 'Qada (makeup)'}
                          </button>
                          <button
                            onClick={() => setIllnessChoice('waived')}
                            className={`flex-1 px-3 py-2 rounded-lg border text-sm ${illnessChoice === 'waived' ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-foreground'}`}
                          >
                            {isAr ? 'ساقطة' : 'Waived'}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}

                <p className="text-xs font-semibold text-muted-foreground">{isAr ? 'تاريخ البدء' : 'Start date'}</p>
                <DaysAgoStepper value={startDaysAgo} onChange={setStartDaysAgo} isAr={isAr} />

                <button onClick={() => setIsOngoing((v) => !v)} className="flex items-center gap-2 text-sm text-foreground">
                  <span>{isOngoing ? '☑️' : '⬜'}</span>
                  <span>{isAr ? 'مستمرة (لم تنتهِ بعد)' : "Ongoing (hasn't ended yet)"}</span>
                </button>

                {!isOngoing && (
                  <>
                    <p className="text-xs font-semibold text-muted-foreground">{isAr ? 'تاريخ الانتهاء' : 'End date'}</p>
                    <DaysAgoStepper value={endDaysAgo} onChange={setEndDaysAgo} isAr={isAr} max={startDaysAgo} />
                  </>
                )}

                <div className="flex gap-2 pt-1">
                  <Button variant="outline" className="flex-1" onClick={resetForm}>{isAr ? 'إلغاء' : 'Cancel'}</Button>
                  <Button className="flex-1 bg-primary hover:bg-primary/90" onClick={handleSave} disabled={!canSave}>
                    {isAr ? 'حفظ' : 'Save'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DaysAgoStepper({ value, onChange, isAr, max }: { value: number; onChange: (v: number) => void; isAr: boolean; max?: number }) {
  const label = value === 0 ? (isAr ? 'اليوم' : 'Today') : (isAr ? `قبل ${value} يوم` : `${value} day${value === 1 ? '' : 's'} ago`);
  return (
    <div className="flex items-center gap-3">
      <button onClick={() => onChange(Math.min(max ?? 365, value + 1))} className="px-3 py-1 rounded bg-secondary">−</button>
      <span className="text-sm font-medium min-w-[100px] text-center">{label}</span>
      <button onClick={() => onChange(Math.max(0, value - 1))} className="px-3 py-1 rounded bg-secondary">+</button>
    </div>
  );
}
