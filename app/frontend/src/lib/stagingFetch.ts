export function stagingFetch(origin: string, transport: typeof fetch = fetch): typeof fetch {
  const allowed = new URL(origin).origin;
  return (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.origin !== allowed) throw new Error('Blocked non-staging Supabase request');
    return transport(input, {...init, redirect: 'error'});
  };
}
