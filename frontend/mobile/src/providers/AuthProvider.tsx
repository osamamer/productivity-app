import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { jwtDecode } from 'jwt-decode';
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { appConfig, keycloakIssuer } from '@/lib/config';
import {
  CONNECTION_ERROR_MESSAGE,
  GENERIC_ERROR_MESSAGE,
  reportError,
  signInResponseMessage,
} from '@/lib/errors';
import { registerTokenResolver } from '@/services/auth-session';
import type { UserInfo } from '@/types/models';

WebBrowser.maybeCompleteAuthSession();

const STORAGE_KEY = 'solife.keycloak.refresh-token';
const USER_STORAGE_KEY = 'solife.keycloak.user';
const redirectUri = AuthSession.makeRedirectUri({ scheme: appConfig.scheme, path: 'auth' });

interface KeycloakClaims {
  sub?: string;
  email?: string;
  given_name?: string;
  family_name?: string;
  preferred_username?: string;
}

interface AuthContextValue {
  loading: boolean;
  isAuthenticated: boolean;
  user: UserInfo | null;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function userFromToken(token: AuthSession.TokenResponse): UserInfo | null {
  try {
    const claims = jwtDecode<KeycloakClaims>(token.idToken ?? token.accessToken);
    return {
      id: claims.sub ?? '',
      email: claims.email ?? '',
      firstName: claims.given_name ?? '',
      lastName: claims.family_name ?? '',
      username: claims.preferred_username ?? '',
    };
  } catch {
    return null;
  }
}

function tokenErrorCode(cause: unknown): string | undefined {
  return cause instanceof AuthSession.ResponseError ? cause.code : undefined;
}

function isInvalidRefreshToken(cause: unknown): boolean {
  return tokenErrorCode(cause) === 'invalid_grant';
}

async function readStoredUser(): Promise<UserInfo | null> {
  const storedUser = await SecureStore.getItemAsync(USER_STORAGE_KEY);
  if (!storedUser) return null;
  try {
    const parsed = JSON.parse(storedUser) as Partial<UserInfo>;
    if (typeof parsed.id !== 'string' || !parsed.id) return null;
    return {
      id: parsed.id,
      email: typeof parsed.email === 'string' ? parsed.email : '',
      firstName: typeof parsed.firstName === 'string' ? parsed.firstName : '',
      lastName: typeof parsed.lastName === 'string' ? parsed.lastName : '',
      username: typeof parsed.username === 'string' ? parsed.username : '',
    };
  } catch (cause) {
    console.error('Could not read stored mobile user:', cause);
    return null;
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const discovery = AuthSession.useAutoDiscovery(keycloakIssuer);
  const tokenRef = useRef<AuthSession.TokenResponse | null>(null);
  const refreshPromiseRef = useRef<Promise<AuthSession.TokenResponse> | null>(null);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const commitToken = useCallback(async (token: AuthSession.TokenResponse) => {
    const previousRefreshToken = tokenRef.current?.refreshToken;
    if (!token.refreshToken && previousRefreshToken) token.refreshToken = previousRefreshToken;
    tokenRef.current = token;
    const nextUser = userFromToken(token);
    setUser(nextUser);
    if (token.refreshToken) await SecureStore.setItemAsync(STORAGE_KEY, token.refreshToken);
    if (nextUser) await SecureStore.setItemAsync(USER_STORAGE_KEY, JSON.stringify(nextUser));
  }, []);

  const clearSession = useCallback(async () => {
    tokenRef.current = null;
    setUser(null);
    const results = await Promise.allSettled([
      SecureStore.deleteItemAsync(STORAGE_KEY),
      SecureStore.deleteItemAsync(USER_STORAGE_KEY),
    ]);
    results.forEach(result => {
      if (result.status === 'rejected') {
        console.error('Could not clear a stored mobile session value:', result.reason);
      }
    });
  }, []);

  const refresh = useCallback(async (): Promise<AuthSession.TokenResponse> => {
    if (!discovery) throw new Error('Keycloak discovery is not available');
    const refreshToken = tokenRef.current?.refreshToken ?? (await SecureStore.getItemAsync(STORAGE_KEY));
    if (!refreshToken) throw new Error('No saved session');
    if (!refreshPromiseRef.current) {
      refreshPromiseRef.current = AuthSession.refreshAsync(
        { clientId: appConfig.keycloakClientId, refreshToken },
        discovery,
      ).finally(() => {
        refreshPromiseRef.current = null;
      });
    }
    const token = await refreshPromiseRef.current;
    await commitToken(token);
    return token;
  }, [commitToken, discovery]);

  const getAccessToken = useCallback(
    async (forceRefresh = false): Promise<string | null> => {
      const current = tokenRef.current;
      if (!forceRefresh && current && AuthSession.TokenResponse.isTokenFresh(current, -45)) {
        return current.accessToken;
      }
      try {
        return (await refresh()).accessToken;
      } catch (cause) {
        console.error('Mobile token refresh failed:', { code: tokenErrorCode(cause) }, cause);
        if (isInvalidRefreshToken(cause)) await clearSession();
        return current?.accessToken ?? null;
      }
    },
    [clearSession, refresh],
  );

  useEffect(() => registerTokenResolver(getAccessToken), [getAccessToken]);

  useEffect(() => {
    if (!discovery) return;
    let cancelled = false;
    void (async () => {
      try {
        const refreshToken = await SecureStore.getItemAsync(STORAGE_KEY);
        if (!refreshToken) {
          await SecureStore.deleteItemAsync(USER_STORAGE_KEY);
          return;
        }
        const storedUser = await readStoredUser();
        if (storedUser && !cancelled) setUser(storedUser);
        await refresh();
      } catch (cause) {
        console.error('Mobile session restore failed:', { code: tokenErrorCode(cause) }, cause);
        if (isInvalidRefreshToken(cause)) await clearSession();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clearSession, discovery, refresh]);

  useEffect(() => {
    if (discovery) return;
    const timer = setTimeout(() => {
      setError(GENERIC_ERROR_MESSAGE);
      setLoading(false);
    }, 8_000);
    return () => clearTimeout(timer);
  }, [discovery]);

  const login = useCallback(async (email: string, password: string) => {
    if (!discovery?.tokenEndpoint) {
      setError(GENERIC_ERROR_MESSAGE);
      return;
    }
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setError(null);
    try {
      const response = await fetch(discovery.tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'password',
          client_id: appConfig.keycloakClientId,
          username: email.trim(),
          password,
          scope: 'openid profile email offline_access',
        }).toString(),
      });
      const payload = await response.json() as {
        access_token?: string;
        refresh_token?: string;
        id_token?: string;
        token_type?: string;
        expires_in?: number;
        scope?: string;
        error?: string;
        error_description?: string;
      };
      if (!response.ok || !payload.access_token) {
        setError(signInResponseMessage(payload.error, payload.error_description));
        return;
      }
      await commitToken(new AuthSession.TokenResponse({
        accessToken: payload.access_token,
        refreshToken: payload.refresh_token,
        idToken: payload.id_token,
        tokenType: payload.token_type as AuthSession.TokenResponse['tokenType'],
        expiresIn: payload.expires_in,
        scope: payload.scope,
      }, payload));
    } catch (cause) {
      const fallbackMessage = reportError('Native sign in failed', cause);
      setError(cause instanceof TypeError ? CONNECTION_ERROR_MESSAGE : fallbackMessage);
    }
  }, [commitToken, discovery]);

  const logout = useCallback(async () => {
    const idToken = tokenRef.current?.idToken;
    await clearSession();
    if (!discovery?.endSessionEndpoint) return;
    const params = new URLSearchParams({
      client_id: appConfig.keycloakClientId,
      post_logout_redirect_uri: redirectUri,
    });
    if (idToken) params.set('id_token_hint', idToken);
    try {
      await WebBrowser.openAuthSessionAsync(`${discovery.endSessionEndpoint}?${params}`, redirectUri);
    } catch {
      // The local session is already removed; browser logout is best effort.
    }
  }, [clearSession, discovery]);

  const value = useMemo(
    () => ({ loading, isAuthenticated: Boolean(user), user, error, login, logout }),
    [error, loading, login, logout, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}

export { redirectUri as mobileAuthRedirectUri };
