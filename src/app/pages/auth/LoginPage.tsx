import React, { useState } from 'react';
import appLogo from '@/assets/polesheadlamp-app-logo-round.png';
import { supabase } from '../../../lib/supabaseClient';
import { publicAnonKey, supabaseUrl } from '/utils/supabase/info';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Loader2, Lock, Mail, AlertCircle, Eye, EyeOff, LogIn, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

const LOCAL_AUTH_SESSION_KEY = 'rhi-v2-local-session';
const useLocalAuth = import.meta.env.VITE_AUTH_MODE === 'local';
const LOGIN_TIMEOUT_MS = 18_000;
const LOGIN_MAX_ATTEMPTS = 2;
const LOGIN_RETRY_BASE_DELAY_MS = 700;

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

  const sessionPayload = payload as {
    access_token?: string;
    refresh_token?: string;
  } | null;

  if (!sessionPayload?.access_token || !sessionPayload?.refresh_token) {
    throw new Error('Auth server tidak mengembalikan session login.');
  }

  return supabase.auth.setSession({
    access_token: sessionPayload.access_token,
    refresh_token: sessionPayload.refresh_token,
  });
};

const signInWithRetry = async (email: string, password: string): Promise<PasswordSignInResult> => {
  let lastRetryableResult: PasswordSignInResult | null = null;

  for (let attempt = 1; attempt <= LOGIN_MAX_ATTEMPTS; attempt += 1) {
    try {
      const result = await withAbortableTimeout(
        (signal) => signInWithDirectAuth(email, password, signal),
        LOGIN_TIMEOUT_MS,
        'Login timeout. Koneksi ke server auth terlalu lama. Coba ulang beberapa detik lagi.',
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
      return 'Koneksi ke server auth sedang lambat atau gagal. Coba lagi beberapa detik lagi.';
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
