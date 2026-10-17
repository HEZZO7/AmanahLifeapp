import { servePayments } from '../_shared/lemonRuntime.ts';

// Static endpoint mode. No header, request body or URL can switch credentials.
servePayments('webhook', 'test');
