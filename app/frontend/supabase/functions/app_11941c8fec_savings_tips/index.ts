import { serveAi } from '../_shared/aiRuntime.ts';
import { createHandler } from './handler.ts';

serveAi(createHandler);

