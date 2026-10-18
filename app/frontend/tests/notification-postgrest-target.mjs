// Dedicated test-only target selection. Never reuse VITE_/production variables.
export const productionProjectRef = 'nyhsnvjdgifphwkqzwel';
export const flags = ['prayer_reminders', 'bill_reminders', 'habit_reminders', 'fasting_reminders', 'savings_reminders', 'general_activity'];
export const location = ['timezone', 'language', 'prayer_calc_method', 'prayer_location_mode', 'prayer_manual_city'];
export const columns = ['user_id', ...flags, ...location].join(',');
export function claims(token) {
  try {
    if (typeof token !== 'string' || token.length > 16000 || token.split('.').length !== 3) throw Error();
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
  } catch { throw Error('Invalid test JWT format'); }
}
export function target(env) {
  if (env.NOTIFICATION_TEST_MUTATION !== 'synthetic-users-only') throw Error('Synthetic-account mutation approval required');
  const mode = env.NOTIFICATION_TEST_MODE;
  const url = new URL(env.NOTIFICATION_TEST_URL);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') throw Error('Unexpected target URL');
  if (mode === 'local-ci') {
    if (url.origin !== 'http://127.0.0.1:3000') throw Error('Local CI requires loopback PostgREST');
  } else if (mode === 'isolated-hosted') {
    const ref = env.NOTIFICATION_TEST_PROJECT_REF;
    if (!/^[a-z]{20}$/.test(ref ?? '') || ref === productionProjectRef
        || url.origin !== `https://${ref}.supabase.co`) throw Error('Approved isolated Supabase project required; production forbidden');
  } else throw Error('Explicit isolated test mode required');
  const tokens = [env.NOTIFICATION_TEST_JWT_A, env.NOTIFICATION_TEST_JWT_B];
  const users = tokens.map(token => {
    const c = claims(token);
    if (c.role !== 'authenticated' || c.aud !== 'authenticated'
        || !/^[0-9a-f-]{36}$/i.test(c.sub ?? '') || !(c.exp > Date.now() / 1000 + 90)) throw Error('Two valid authenticated test sessions required');
    if (mode === 'isolated-hosted' && c.iss !== `${url.origin}/auth/v1`) throw Error('JWT issuer does not match isolated target');
    return c.sub;
  });
  if (users[0] === users[1]) throw Error('Two distinct test users required');
  if (mode === 'isolated-hosted') {
    const key = env.NOTIFICATION_TEST_PUBLIC_KEY ?? '';
    if (!key || key.startsWith('sb_secret_')) throw Error('Public project key required; privileged keys forbidden');
    if (!key.startsWith('sb_publishable_') && claims(key).role !== 'anon') throw Error('Only publishable/anon project keys permitted');
  }
  return {mode, origin: url.origin, rest: url.origin + (mode === 'isolated-hosted' ? '/rest/v1' : ''),
    tokens, users, publicKey: mode === 'isolated-hosted' ? env.NOTIFICATION_TEST_PUBLIC_KEY : undefined};
}
