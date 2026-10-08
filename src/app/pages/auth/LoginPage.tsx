import React, { useState } from 'react';
import appLogo from '@/assets/polesheadlamp-app-logo-round.png';
import { supabase } from '../../../lib/supabaseClient';
import { projectId, publicAnonKey, supabaseUrl } from '/utils/supabase/info';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Loader2, Lock, Mail, AlertCircle, Eye, EyeOff, LogIn, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import type { Session, User } from '@supabase/supabase-js';

const LOCAL_AUTH_SESSION_KEY = 'rhi-v2-local-session';
const useLocalAuth = import.meta.env.VITE_AUTH_MODE === 'local';
const LOGIN_TIMEOUT_MS = 12_000;
const LOGIN_MAX_ATTEMPTS = 1;
const LOGIN_RETRY_BASE_DELAY_MS = 700;
const SUPABASE_SET_SESSION_TIMEOUT_MS = 2_500;
const AUTH_SERVER_UNAVAILABLE_MESSAGE =
  'Server auth Supabase belum merespons. Ini bukan indikasi password salah; coba lagi setelah koneksi server normal.';

const clearSupabaseAuthStorage = () => {
  for (const key of Object.keys(window.localStorage)) {
    if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
      window.localStorage.removeItem(key);
    }
  }
};

const withAbortableTimeout = async <T,>(
  buildPromise: (signal: AbortSignal) => PromiseLike<T>,
  timeoutMs: number,
  message: string,
): Promise<T> => {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let didTimeout = false;

  try {
    return await Promise.race([
      buildPromise(controller.signal),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          didTimeout = true;
          controller.abort(message);
          reject(new Error(message));
        }, timeoutMs);
      }),
    ]);
  } catch (error) {
    if (didTimeout) {
      throw new Error(message);
    }
    throw error;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

const isRetryableLoginError = (err: unknown) => {
  if (err instanceof Error) {
    return (
      err.name === 'AuthRetryableFetchError' ||
      err.name === 'AbortError' ||
      err.message.includes('Failed to fetch') ||
      err.message.includes('timeout') ||
      err.message.includes('Koneksi Supabase timeout') ||
      err.message.includes('504') ||
      err.message.toLowerCase().includes('gateway') ||
      err.message.toLowerCase().includes('server error') ||
      err.message === '{}' ||
      err.message.trim() === ''
    );
  }

  return false;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type PasswordSignInResult = Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>;

const parseAuthErrorPayload = (payload: unknown) => {
  if (!payload || typeof payload !== 'object') return '';
  const record = payload as Record<string, unknown>;
  return String(
    record.error_description ||
    record.msg ||
    record.message ||
    record.error ||
    '',
  );
};

const decodeJwtPayload = (token?: string | null) => {
  if (!token) return null;
  const payload = token.split('.')[1];
  if (!payload) return null;

  try {
    const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');
    const paddedPayload = normalizedPayload.padEnd(
      normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4),
      '=',
    );
    return JSON.parse(window.atob(paddedPayload)) as {
      sub?: string;
      email?: string;
      exp?: number;
      role?: string;
      aud?: string;
    };
  } catch {
    return null;
  }
};

type DirectAuthPayload = Partial<Session> & {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  expires_at?: number;
  token_type?: string;
  user?: User;
};

const buildFallbackUser = (email: string, tokenPayload: ReturnType<typeof decodeJwtPayload>): User => {
  const now = new Date().toISOString();

  return {
    id: tokenPayload?.sub || email,
    aud: tokenPayload?.aud || 'authenticated',
    role: tokenPayload?.role || 'authenticated',
    email,
    email_confirmed_at: now,
    phone: '',
    confirmed_at: now,
    last_sign_in_at: now,
    app_metadata: {},
    user_metadata: {},
    identities: [],
    created_at: now,
    updated_at: now,
    is_anonymous: false,
  };
};

const persistDirectAuthSession = (payload: DirectAuthPayload, email: string): Session => {
  const tokenPayload = decodeJwtPayload(payload.access_token);
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = Number(payload.expires_at || tokenPayload?.exp || (now + Number(payload.expires_in || 3600)));
  const session = {
    ...payload,
    access_token: payload.access_token!,
    refresh_token: payload.refresh_token!,
    expires_at: expiresAt,
    expires_in: Number(payload.expires_in || Math.max(expiresAt - now, 0)),
    token_type: payload.token_type || 'bearer',
    user: payload.user || buildFallbackUser(email, tokenPayload),
  } as Session;

  if (projectId) {
    window.localStorage.setItem(`sb-${projectId}-auth-token`, JSON.stringify(session));
  }

  return session;
};

const setSupabaseSessionBestEffort = async (session: Session): Promise<PasswordSignInResult> => {
  const fallbackResult = {
    data: {
      session,
      user: session.user,
    },
    error: null,
  } as PasswordSignInResult;

  try {
    const result = await Promise.race([
      supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      }),
      new Promise<PasswordSignInResult>((resolve) => {
        window.setTimeout(() => resolve(fallbackResult), SUPABASE_SET_SESSION_TIMEOUT_MS);
      }),
    ]);

    if (result.error && isRetryableLoginError(result.error)) {
      console.warn('[Login] Supabase setSession returned retryable error after direct auth; using persisted session.', result.error);
      return fallbackResult;
    }

    return result;
  } catch (error) {
    console.warn('[Login] Supabase setSession failed after direct auth; using persisted session.', error);
    return fallbackResult;
  }
};

const signInWithDirectAuth = async (
  email: string,
  password: string,
  signal: AbortSignal,
): Promise<PasswordSignInResult> => {
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: publicAnonKey,
      Authorization: `Bearer ${publicAnonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
    signal,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(parseAuthErrorPayload(payload) || `Auth server error ${response.status}`);
  }

  const sessionPayload = payload as DirectAuthPayload | null;

  if (!sessionPayload?.access_token || !sessionPayload?.refresh_token) {
    throw new Error('Auth server tidak mengembalikan session login.');
  }

  clearSupabaseAuthStorage();
  const session = persistDirectAuthSession(sessionPayload, email);

  return setSupabaseSessionBestEffort(session);
};

const signInWithRetry = async (email: string, password: string): Promise<PasswordSignInResult> => {
  let lastRetryableResult: PasswordSignInResult | null = null;

  for (let attempt = 1; attempt <= LOGIN_MAX_ATTEMPTS; attempt += 1) {
    try {
      const result = await withAbortableTimeout(
        (signal) => signInWithDirectAuth(email, password, signal),
        LOGIN_TIMEOUT_MS,
        AUTH_SERVER_UNAVAILABLE_MESSAGE,
      );

      if (!result.error || !isRetryableLoginError(result.error) || attempt === LOGIN_MAX_ATTEMPTS) {
        return result;
      }

      lastRetryableResult = result;
    } catch (err) {
      if (!isRetryableLoginError(err) || attempt === LOGIN_MAX_ATTEMPTS) {
        throw err;
      }
    }

    await sleep(LOGIN_RETRY_BASE_DELAY_MS * attempt);
  }

  return lastRetryableResult as PasswordSignInResult;
};

const getLoginErrorMessage = (err: unknown) => {
  if (err instanceof Error) {
    if (err.message === 'Invalid login credentials') {
      return 'Email atau password salah. Silakan cek kembali.';
    }

    if (isRetryableLoginError(err)) {
      return AUTH_SERVER_UNAVAILABLE_MESSAGE;
    }

    return err.message;
  }

  if (typeof err === 'string' && err.trim()) {
    return err;
  }

  return 'Terjadi kesalahan saat login. Coba lagi beberapa detik lagi.';
};

export const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (useLocalAuth) {
        localStorage.setItem(LOCAL_AUTH_SESSION_KEY, 'active');
        localStorage.setItem('rhi-v2-local-email', email.trim() || 'owner@polesheadlamp.id');
        localStorage.setItem('app_last_active', Date.now().toString());
        toast.success('Login lokal v2 berhasil.');
        window.location.href = '/dashboard/';
        return;
      }

      // LOGIN LOGIC
      const { error } = await signInWithRetry(email.trim(), password);
      if (error) throw error;

      // FIX: Reset activity timer to prevent immediate auto-logout due to old session data
      const timestamp = Date.now().toString();
      localStorage.setItem('app_last_active', timestamp);
      console.log(`[Login] Activity tracker reset: ${timestamp}`);

      toast.success('Login berhasil!');
      window.location.replace('/dashboard/');
    } catch (err: any) {
      console.error('Auth error:', err);
      setError(getLoginErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterClick = () => {
    const phoneNumber = "6285692875262";
    const message = "Halo Admin, saya ingin mengajukan pendaftaran akun baru untuk sistem Restoration Headlamp Indonesia. Mohon bantuannya.";
    const url = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  return (
    <main className="loginShell">
      <section className="loginCard">
        <span className="loginMark brandLogo">
          <img src={appLogo} alt="Poles Headlamp.ID" />
        </span>
        <div className="loginHeading">
          <p className="loginEyebrow">RHI System</p>
          <h1>Restoration Headlamp</h1>
        </div>
        <p className="loginSub">Masuk untuk mengelola data operasional internal.</p>

          <form onSubmit={handleAuth} className="loginForm">
            {error && (
              <div className="errorBanner">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="loginField">
              <Label htmlFor="email">Email</Label>
              <div className="inputWithIcon">
                <Mail size={17} />
                <Input
                  id="email"
                  type="email"
                  placeholder="nama@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="loginField">
              <Label htmlFor="password">Password</Label>
              <div className="inputWithIcon">
                <Lock size={17} />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="passwordToggle"
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <Button type="submit" className="loginButton" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="spin h-4 w-4" />
                  Processing...
                </>
              ) : (
                <>
                  <LogIn className="h-6 w-6" />
                  Masuk ke Dashboard
                </>
              )}
            </Button>
          </form>

        <footer className="loginFoot">
           <button
              type="button"
              onClick={handleRegisterClick}
              className="loginLinkButton"
           >
              Lupa password?
           </button>
           <p className="loginAccessNote">
             <ShieldCheck className="h-4 w-4" />
             Akses mengikuti role dan akses khusus user.
           </p>
        </footer>
      </section>
    </main>
  );
};
