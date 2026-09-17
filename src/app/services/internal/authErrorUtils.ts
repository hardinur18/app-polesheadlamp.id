export function getAuthErrorMessage(error: unknown) {
  if (!error) return '';
  if (error instanceof Error) return error.message || error.name || '';
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message || '');
  }
  return String(error);
}

export function isRetryableAuthError(error: unknown) {
  const message = getAuthErrorMessage(error).toLowerCase();
  const name = error instanceof Error ? error.name : '';

  return (
    name === 'AuthRetryableFetchError' ||
    message.includes('failed to fetch') ||
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('load failed') ||
    message.includes('temporarily') ||
    message.includes('connection')
  );
}

export function isFatalSessionError(error: unknown) {
  const message = getAuthErrorMessage(error).toLowerCase();

  return (
    message.includes('refresh token not found') ||
    message.includes('invalid refresh token') ||
    message.includes('refresh token has expired') ||
    message.includes('already used') ||
    message.includes('invalid_grant')
  );
}
