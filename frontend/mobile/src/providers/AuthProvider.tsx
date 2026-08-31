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
import { registerTokenResolver } from '@/services/auth-session';
import type { UserInfo } from '@/types/models';

WebBrowser.maybeCompleteAuthSession();

const STORAGE_KEY = 'solife.keycloak.refresh-token';
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
  login: () => Promise<void>;
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

export function AuthProvider({ children }: PropsWithChildren) {
  const discovery = AuthSession.useAutoDiscovery(keycloakIssuer);
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: appConfig.keycloakClientId,
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      scopes: ['openid', 'profile', 'email', 'offline_access'],
      usePKCE: true,
    },
    discovery,
  );
  const tokenRef = useRef<AuthSession.TokenResponse | null>(null);
  const refreshPromiseRef = useRef<Promise<AuthSession.TokenResponse> | null>(null);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const commitToken = useCallback(async (token: AuthSession.TokenResponse) => {
    const previousRefreshToken = tokenRef.current?.refreshToken;
    if (!token.refreshToken && previousRefreshToken) token.refreshToken = previousRefreshToken;
    tokenRef.current = token;
    setUser(userFromToken(token));
    if (token.refreshToken) await SecureStore.setItemAsync(STORAGE_KEY, token.refreshToken);
  }, []);

  const clearSession = useCallback(async () => {
    tokenRef.current = null;
    setUser(null);
    await SecureStore.deleteItemAsync(STORAGE_KEY);
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
      if (!forceRefresh && current && AuthSession.TokenResponse.isTokenFresh(current, 45)) {
        return current.accessToken;
      }
      try {
        return (await refresh()).accessToken;
      } catch {
        await clearSession();
        return null;
      }
    },
    [clearSession, refresh],
  );

  useEffect(() => registerTokenResolver(getAccessToken), [getAccessToken]);

  useEffect(() => {
    if (!discovery) return;
    let cancelled = false;
    void refresh()
      .catch(() => clearSession())
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clearSession, discovery, refresh]);

  useEffect(() => {
    if (discovery) return;
    const timer = setTimeout(() => {
      setError(`Could not reach Keycloak at ${keycloakIssuer}. Check the mobile environment settings.`);
      setLoading(false);
    }, 8_000);
    return () => clearTimeout(timer);
  }, [discovery]);

  useEffect(() => {
    if (response?.type !== 'success' || !discovery || !request?.codeVerifier) return;
    void AuthSession.exchangeCodeAsync(
      {
        clientId: appConfig.keycloakClientId,
        code: response.params.code,
        redirectUri,
        extraParams: { code_verifier: request.codeVerifier },
      },
      discovery,
    )
      .then(commitToken)
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : 'Sign in failed.');
      })
      .finally(() => setLoading(false));
  }, [commitToken, discovery, request?.codeVerifier, response]);

  const login = useCallback(async () => {
    if (!request) {
      setError(`Keycloak is not ready at ${keycloakIssuer}.`);
      return;
    }
    setError(null);
    const result = await promptAsync();
    if (result.type === 'error') setError(result.error?.message ?? 'Sign in failed.');
  }, [promptAsync, request]);

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
