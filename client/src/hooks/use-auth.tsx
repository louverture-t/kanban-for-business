import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { useMutation, useLazyQuery } from '@apollo/client/react';
import { setAccessToken, clearAccessToken } from '@client/utils/auth';
import { apolloClient } from '@client/lib/apolloClient';
import {
  ME_QUERY,
  LOGIN_MUTATION,
  LOGOUT_MUTATION,
  REFRESH_TOKEN_MUTATION,
} from '@client/graphql/operations';
import type { IUser, UserRole } from '@shared/types';

interface AuthContextValue {
  user: IUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  isSuperadmin: boolean;
  isManagerOrAbove: boolean;
  login: (username: string, password: string) => Promise<IUser>;
  logout: () => Promise<void>;
  refetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<IUser | null>(null);
  const [loading, setLoading] = useState(true);

  const [fetchMe] = useLazyQuery(ME_QUERY, { fetchPolicy: 'network-only' });
  const [loginMutation] = useMutation(LOGIN_MUTATION);
  const [logoutMutation] = useMutation(LOGOUT_MUTATION);
  const [refreshMutation] = useMutation(REFRESH_TOKEN_MUTATION);

  // On mount: try refresh → fetch me
  useEffect(() => {
    (async () => {
      try {
        const { data } = await refreshMutation() as { data: any };
        if (data?.refreshToken?.token) {
          setAccessToken(data.refreshToken.token);
          setUser(data.refreshToken.user);
        }
      } catch {
        clearAccessToken();
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = useCallback(
    async (username: string, password: string): Promise<IUser> => {
      const { data } = await loginMutation({ variables: { username, password } }) as { data: any };
      const { token, user: loggedInUser } = data.login;
      setAccessToken(token);
      setUser(loggedInUser);
      return loggedInUser;
    },
    [loginMutation],
  );

  const logout = useCallback(async () => {
    try {
      await logoutMutation();
    } finally {
      clearAccessToken();
      setUser(null);
      await apolloClient.clearStore();
    }
  }, [logoutMutation]);

  const refetchUser = useCallback(async () => {
    try {
      const { data } = await fetchMe() as { data: any };
      if (data?.me) {
        setUser(data.me);
      }
    } catch {
      clearAccessToken();
      setUser(null);
    }
  }, [fetchMe]);

  const isAuthenticated = !!user;
  const isSuperadmin = user?.role === ('superadmin' as UserRole);
  const isManagerOrAbove =
    user?.role === ('superadmin' as UserRole) ||
    user?.role === ('manager' as UserRole);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated,
        isSuperadmin,
        isManagerOrAbove,
        login,
        logout,
        refetchUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
