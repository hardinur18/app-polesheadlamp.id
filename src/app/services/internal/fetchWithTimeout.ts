const DEFAULT_REQUEST_TIMEOUT_MS = 12_000;

export function isRequestTimeoutError(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === 'AbortError' ||
      error.message.toLowerCase().includes('timeout') ||
      error.message.toLowerCase().includes('terlalu lama'))
  );
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  timeoutMessage = 'Request ke server terlalu lama. Coba ulang beberapa detik lagi.',
) {
  const controller = new AbortController();
  const upstreamSignal = init.signal;
  let didTimeout = false;

  const handleUpstreamAbort = () => {
    controller.abort(upstreamSignal?.reason);
  };

  if (upstreamSignal?.aborted) {
    handleUpstreamAbort();
  } else {
    upstreamSignal?.addEventListener('abort', handleUpstreamAbort, { once: true });
  }

  const timeoutId = globalThis.setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (didTimeout || isRequestTimeoutError(error)) {
      throw new Error(timeoutMessage);
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
    upstreamSignal?.removeEventListener('abort', handleUpstreamAbort);
  }
}
