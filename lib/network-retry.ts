// The first request after a cold launch can fail while DNS and TLS warm up,
// so a network-layer failure is retried once. API errors are never retried.
export async function withNetworkRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const isNetworkFailure = err instanceof TypeError || (err instanceof Error && /network/i.test(err.message));
    if (!isNetworkFailure) throw err;
    await new Promise((resolve) => setTimeout(resolve, 700));
    return fn();
  }
}
