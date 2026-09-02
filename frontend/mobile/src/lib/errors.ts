export const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.';

export const INVALID_CREDENTIALS_MESSAGE = 'The email or password is incorrect.';

export const SIGN_IN_UNAVAILABLE_MESSAGE =
  'Sign-in is temporarily unavailable. Please try again later.';

export const CONNECTION_ERROR_MESSAGE =
  'We couldn’t connect. Check your internet connection and try again.';

export function signInResponseMessage(errorCode?: string, errorDescription?: string): string {
  const code = errorCode?.toLowerCase();
  const description = errorDescription?.toLowerCase() ?? '';

  if (code === 'invalid_grant' || description.includes('invalid user credentials')) {
    return INVALID_CREDENTIALS_MESSAGE;
  }

  if (
    code === 'invalid_client' ||
    code === 'unauthorized_client' ||
    description.includes('direct access grants')
  ) {
    return SIGN_IN_UNAVAILABLE_MESSAGE;
  }

  return GENERIC_ERROR_MESSAGE;
}

export function reportError(context: string, cause: unknown): string {
  console.error(`${context}:`, cause);
  return GENERIC_ERROR_MESSAGE;
}
