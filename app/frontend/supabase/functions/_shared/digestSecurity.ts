type Challenge = { id: string; name: string; icon: string; targetAmount: number; savedAmount: number; completedMilestones: number[] };
export function digestData(value: unknown): { challenges: Challenge[] } | null {
  if (value === null || value === undefined) return { challenges: [] };
  if (typeof value !== 'object' || Array.isArray(value)) return null;
  const list = (value as Record<string, unknown>).challenges;
  if (!Array.isArray(list) || list.length > 100) return null;
  const challenges: Challenge[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const row = item as Record<string, unknown>;
    if (!['id', 'name', 'icon'].every(k => typeof row[k] === 'string' && (row[k] as string).length <= 200) ||
        typeof row.targetAmount !== 'number' || !Number.isFinite(row.targetAmount) || row.targetAmount < 0 ||
        typeof row.savedAmount !== 'number' || !Number.isFinite(row.savedAmount) || row.savedAmount < 0 ||
        !Array.isArray(row.completedMilestones) || row.completedMilestones.length > 4 ||
        !row.completedMilestones.every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100)) return null;
    challenges.push({ id: row.id as string, name: row.name as string, icon: row.icon as string,
      targetAmount: row.targetAmount, savedAmount: row.savedAmount, completedMilestones: row.completedMilestones });
  }
  return { challenges };
}
export const escapeDigestHTML = (value: string) => value.replace(/[&<>"']/g, character =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
