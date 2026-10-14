import * as Sentry from '@sentry/react';
import { sentryOptions } from '@/lib/sentry';

// Imported first in main.tsx, so errors during start-up are caught too
const options = sentryOptions(import.meta.env);
if (options) Sentry.init(options);
