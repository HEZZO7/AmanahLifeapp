// Allowlist test metadata. Never serialize SQL, parameters, assertion values or env.
export function safeEvent({ type, data = {} }) {
  if (type === 'test:pass' || type === 'test:fail') return {
    type, name: data.name, skip: !!data.skip, todo: !!data.todo,
    errorCode: String(data.details?.error?.cause?.code ?? data.details?.error?.code ?? '').replace(/[^A-Z0-9_]/g, '').slice(0, 80),
    failureType: String(data.details?.error?.failureType ?? '').replace(/[^a-zA-Z]/g, '').slice(0, 80),
  };
  if (type === 'test:summary') return { type, counts: data.counts, success: data.success };
  return null;
}
export default async function* reporter(events) {
  for await (const event of events) {
    const safe = safeEvent(event);
    if (safe) yield JSON.stringify(safe) + '\n';
  }
}
