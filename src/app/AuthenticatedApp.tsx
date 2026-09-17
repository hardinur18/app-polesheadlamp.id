import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router';
import { MasterDataProvider } from '@/app/pages/master-data/context';
import { PermissionsProvider } from '@/app/hooks/usePermissions';
import { AppLayout } from './components/layout/AppLayout';
import { AppLoadingScreen } from './components/AppLoadingScreen';
import { LoginPage } from './pages/auth/LoginPage';
import { supabase } from '../lib/supabaseClient';
import { Session } from '@supabase/supabase-js';
import { getAppRouteByPath, getCanonicalAppPath } from '@/app/routing/appRouteRegistry';
import {
  getAuthErrorMessage,
  isFatalSessionError,
  isRetryableAuthError,
} from '@/app/services/internal/authErrorUtils';

const DEFAULT_AUTHENTICATED_PATH = '/dashboard/';
const LOGIN_REDIRECT_STORAGE_KEY = 'app_post_login_redirect';
const LOCAL_AUTH_SESSION_KEY = 'rhi-v2-local-session';
const useLocalAuth = import.meta.env.VITE_AUTH_MODE === 'local';

const hasCachedSupabaseSession = () => {
  if (typeof window === 'undefined') return false;
  return Object.keys(window.localStorage).some((key) => (
    key.startsWith('sb-') &&
    key.endsWith('-auth-token') &&
    Boolean(window.localStorage.getItem(key))
  ));
};

const createLocalSession = (): Session => {
  const email = localStorage.getItem('rhi-v2-local-email') || 'owner@polesheadlamp.id';
  const now = Math.floor(Date.now() / 1000);

  return {
    access_token: 'local-v2-access-token',
    refresh_token: 'local-v2-refresh-token',
    expires_in: 60 * 60 * 24,
    expires_at: now + 60 * 60 * 24,
    token_type: 'bearer',
    user: {
      id: 'local-owner',
      aud: 'authenticated',
      role: 'authenticated',
      email,
      email_confirmed_at: new Date().toISOString(),
      phone: '',
      confirmed_at: new Date().toISOString(),
      last_sign_in_at: new Date().toISOString(),
      app_metadata: { provider: 'local', providers: ['local'] },
      user_metadata: { name: 'Owner Polesheadlamp' },
      identities: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_anonymous: false,
    },
  };
};

export const AuthenticatedApp = () => {
  const location = useLocation();
  const currentRoute = getAppRouteByPath(location.pathname);
  const canonicalPath = currentRoute ? getCanonicalAppPath(currentRoute) : location.pathname;
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (useLocalAuth) {
      const localSessionEnabled = localStorage.getItem(LOCAL_AUTH_SESSION_KEY) === 'active';
      setSession(localSessionEnabled ? createLocalSession() : null);
      setLoading(false);
      return;
    }

    let isActive = true;
    const AUTH_BOOT_TIMEOUT_MS = 20000;
    const AUTH_RETRY_DELAY_MS = 1500;
    const MAX_AUTH_RETRIES = 3;

    const settleAuthState = (nextSession: Session | null) => {
      if (!isActive) return;
      setSession(nextSession);
      setLoading(false);
    };

    const handleAuthError = (error: unknown, retry?: () => void, attempt = 0) => {
      if (!isActive) return;

      const message = getAuthErrorMessage(error);

      if (isRetryableAuthError(error) && retry && attempt < MAX_AUTH_RETRIES) {
        console.warn(`Network connection issue during auth check. Retrying (${attempt + 1}/${MAX_AUTH_RETRIES}).`, message);
        window.setTimeout(retry, AUTH_RETRY_DELAY_MS);
        return;
      }

      if (!isRetryableAuthError(error)) {
        console.error('Unexpected auth error:', error);
        settleAuthState(null);
        return;
      }

      console.warn('Network connection issue during auth check. Keeping cached login instead of forcing logout.');
      if (!hasCachedSupabaseSession()) {
        settleAuthState(null);
      }
    };

    const resolveValidSession = async (nextSession: Session | null) => {
      if (!nextSession?.access_token) {
        settleAuthState(null);
        return;
      }

      const { error: userError } = await supabase.auth.getUser(nextSession.access_token);
      if (!userError) {
        settleAuthState(nextSession);
        return;
      }

      const {
        data: { session: refreshedSession },
        error: refreshError,
      } = await supabase.auth.refreshSession();

      if (!refreshError && refreshedSession?.access_token) {
        settleAuthState(refreshedSession);
        return;
      }

      if (refreshError && isRetryableAuthError(refreshError)) {
        console.warn('Session refresh temporarily failed. Keeping cached session active.', refreshError.message);
        settleAuthState(nextSession);
        return;
      }

      settleAuthState(null);
    };

    const bootTimeout = window.setTimeout(() => {
      if (!isActive) return;
      console.warn('Auth bootstrap timed out. Keeping loading state to avoid forced logout.');
      if (!hasCachedSupabaseSession()) {
        settleAuthState(null);
      }
    }, AUTH_BOOT_TIMEOUT_MS);

    // 1. Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      window.clearTimeout(bootTimeout);
      settleAuthState(session);
    });

    // 2. Check active session
    const checkActiveSession = (attempt = 0) => {
      supabase.auth
        .getSession()
      .then(({ data: { session }, error }) => {
        window.clearTimeout(bootTimeout);

        if (error) {
          if (isRetryableAuthError(error) && attempt < MAX_AUTH_RETRIES) {
            console.warn('Network error during session check:', error.message);
            window.setTimeout(() => checkActiveSession(attempt + 1), AUTH_RETRY_DELAY_MS);
            return;
          }
          if (isRetryableAuthError(error)) {
            console.warn('Network error during session check. Not clearing auth session:', error.message);
            if (hasCachedSupabaseSession()) {
              return;
            }
          } else {
            console.error('Error getting session:', error.message);
          }
          settleAuthState(isFatalSessionError(error) ? null : session);
          return;
        }

        void resolveValidSession(session);
      })
      .catch((err) => {
        window.clearTimeout(bootTimeout);
        handleAuthError(err, () => checkActiveSession(attempt + 1), attempt);
      });
    };

    checkActiveSession();

    return () => {
      isActive = false;
      window.clearTimeout(bootTimeout);
      subscription.unsubscribe();
    };
  }, []);

  // 3. Auto-logout on 24h inactivity
  useEffect(() => {
    if (!session) return;

    const TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours
    const ACTIVITY_KEY = 'app_last_active';

    const updateActivity = () => {
      localStorage.setItem(ACTIVITY_KEY, Date.now().toString());
    };

    const checkInactivity = () => {
      const lastActive = localStorage.getItem(ACTIVITY_KEY);
      const now = Date.now();
      
      if (lastActive && (now - Number(lastActive) > TIMEOUT_MS)) {
        console.log("Session expired due to inactivity (24h)");
        localStorage.removeItem(ACTIVITY_KEY);
        supabase.auth.signOut();
        setSession(null);
      }
    };

    const lastActive = localStorage.getItem(ACTIVITY_KEY);
    if (!lastActive) {
      updateActivity();
    }

    checkInactivity();

    const events = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll', 'click'];
    const handleActivity = () => {
        const lastActive = localStorage.getItem(ACTIVITY_KEY);
        if (!lastActive || Date.now() - Number(lastActive) > 60000) {
            updateActivity();
        }
    };

    events.forEach(event => window.addEventListener(event, handleActivity));
    const interval = setInterval(checkInactivity, 60000);

    return () => {
      events.forEach(event => window.removeEventListener(event, handleActivity));
      clearInterval(interval);
    };
  }, [session]);

  if (canonicalPath !== location.pathname) {
    return <Navigate to={canonicalPath} replace />;
  }

  if (loading) {
    return <AppLoadingScreen />;
  }

  if (!session && currentRoute?.id !== 'login') {
    const intendedPath = `${location.pathname}${location.search}${location.hash}`;
    if (intendedPath && intendedPath !== '/login') {
      sessionStorage.setItem(LOGIN_REDIRECT_STORAGE_KEY, intendedPath);
    }
    return <Navigate to="/login" replace />;
  }

  if (!session) {
    return <LoginPage />;
  }

  if (currentRoute?.id === 'login') {
    const storedRedirect = sessionStorage.getItem(LOGIN_REDIRECT_STORAGE_KEY);
    sessionStorage.removeItem(LOGIN_REDIRECT_STORAGE_KEY);
    const nextPath = storedRedirect?.startsWith('/') && !storedRedirect.startsWith('/login')
      ? storedRedirect
      : DEFAULT_AUTHENTICATED_PATH;
    return <Navigate to={nextPath} replace />;
  }

  return (
    <MasterDataProvider session={session}>
      <PermissionsProvider>
        <AppLayout />
      </PermissionsProvider>
    </MasterDataProvider>
  );
};

export default AuthenticatedApp;
