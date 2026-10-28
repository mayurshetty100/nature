// Client-side reporting for errors caught by the root error boundary.
// Currently just logs to the console; swap in an analytics/error-tracking
// provider here (e.g. Sentry) if you want production error monitoring.
export function reportClientError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  console.error("[error-boundary]", describeThrown(error), {
    route: window.location.pathname,
    ...context,
  });
}

// Loaders and server fns throw raw Responses and plain objects (a Supabase
// `{ message, code, details }`), which String() reduces to "[object ...]".
function describeThrown(error: unknown): string {
  if (error instanceof Response) {
    return `Response ${error.status}${error.url ? ` at ${error.url}` : ""}`;
  }
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  const { message } = (error ?? {}) as { message?: unknown };
  if (typeof message === "string" && message.length > 0) return message;
  try {
    return JSON.stringify(error)?.slice(0, 2000) ?? String(error);
  } catch {
    return String(error);
  }
}
