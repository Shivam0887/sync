import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import { env } from "@/config/env.js";

const isProduction = env.NODE_ENV === "production";

Sentry.init({
  dsn: env.SENTRY_DSN,
  environment: env.NODE_ENV,
  integrations: (integrations) => {
    const result = integrations.filter(
      (integration) => integration.name !== "Console"
    );
    result.push(nodeProfilingIntegration());
    return result;
  },

  // Configure performance monitoring
  // This determines what percentage of requests to monitor for performance
  // 1.0 = 100% (only use in development), 0.2 = 10% (better for production)
  tracesSampleRate: isProduction ? 0.2 : 1.0,

  // Configure profiling - how many transactions to profile in detail
  // This is resource-intensive, so use lower rates in production
  profilesSampleRate: isProduction ? 0.1 : 1.0,

  // Configure error sampling - what percentage of errors to capture
  // Usually you want to capture all errors, but this helps with very high-traffic apps
  sampleRate: isProduction ? 0.8 : 1.0,

  sendDefaultPii: true,
  attachStacktrace: true,

  beforeSend(event) {
    if (event.request?.headers?.authorization) {
      delete event.request.headers.authorization;
    }

    return event;
  },

  initialScope(scope) {
    scope.setTag("service", "user");
    return scope;
  },
});
