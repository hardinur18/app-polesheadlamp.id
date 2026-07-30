import React, { useState } from 'react';
import appLogo from '@/assets/polesheadlamp-app-logo-round.png';
import { supabase } from '../../../lib/supabaseClient';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Loader2, Lock, Mail, AlertCircle, Eye, EyeOff, LogIn, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

const LOCAL_AUTH_SESSION_KEY = 'rhi-v2-local-session';
const useLocalAuth = import.meta.env.DEV || import.meta.env.VITE_AUTH_MODE === 'local';

const getLoginErrorMessage = (err: unknown) => {
  if (err instanceof Error) {
    if (err.message === 'Invalid login credentials') {
      return 'Email atau password salah. Silakan cek kembali.';
    }

    if (
      err.name === 'AuthRetryableFetchError' ||
      err.message.includes('Failed to fetch') ||
      err.message === '{}' ||
      err.message.trim() === ''
    ) {
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
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;

      // Recovery guard: login boleh lanjut hanya kalau profile sudah dibuat oleh admin.
      if (data.user) {
          const { data: profile } = await supabase.from('profiles').select('id, role').eq('id', data.user.id).single();
          if (!profile) {
            await supabase.auth.signOut();
            throw new Error('Profil pengguna belum terdaftar. Hubungi admin untuk melengkapi akses akun.');
          } else {
            console.log(`[Login] User role: ${profile.role}`);
          }
      }

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
