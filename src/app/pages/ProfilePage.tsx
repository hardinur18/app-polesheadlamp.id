import React, { useEffect, useState } from 'react';
import {
  Building,
  ChevronRight,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  Moon,
  Phone,
  Settings,
  Sun,
  User,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';

import profileBg from '@/assets/1c0f2be78a20a7de41a366de35a8cc1a2a972f7c.png';
import { supabase } from '../../lib/supabaseClient';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { OperationalPageHeader, OperationalPageShell } from '../components/ui/operational-page';
import { useMasterData } from './master-data/context';

export const ProfilePage = () => {
  const { currentUser, branches } = useMasterData();
  const { resolvedTheme, theme, setTheme } = useTheme();
  const activeTheme = (theme === 'system' ? resolvedTheme : theme) ?? 'light';
  const isDark = activeTheme === 'dark';
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
  });

  useEffect(() => {
    if (!currentUser) return;

    setFormData((prev) => ({
      ...prev,
      name: currentUser.name || '',
      email: currentUser.email || '',
      phone: currentUser.phone || '',
    }));
  }, [currentUser]);

  const userBranch = branches.find((branch) => branch.id === currentUser?.branchId);

  const handleLogout = async () => {
    const loadingToast = toast.loading('Sedang keluar...');
    try {
      localStorage.clear();
      sessionStorage.clear();
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      toast.dismiss(loadingToast);
      window.location.href = '/';
    }
  };

  if (!currentUser) {
    return (
      <OperationalPageShell className="profilePage">
        <div className="profileLoadingState">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p>Memuat data profil...</p>
        </div>
      </OperationalPageShell>
    );
  }

  return (
    <OperationalPageShell className="profilePage">
      <OperationalPageHeader
        title="Profil Saya"
        subtitle="Kelola informasi akun dan preferensi aplikasi."
        eyebrow="Akun"
        icon={User}
      />

      <div className="profileGrid">
        <section className="profileIdentityPanel">
          <div className="profileCover">
            <img src={profileBg} alt="" />
          </div>

          <div className="profileIdentityBody">
            <div className="profileAvatar">
              {currentUser.avatar ? (
                <img src={currentUser.avatar} alt="" />
              ) : (
                <span>{currentUser.name?.substring(0, 2).toUpperCase() || 'US'}</span>
              )}
            </div>

            <div className="profileIdentityText">
              <h2>{currentUser.name}</h2>
              <p>{currentUser.email}</p>
            </div>

            <div className="profileBadges">
              <Badge variant="secondary" className="border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                {currentUser.role || 'User'}
              </Badge>
              <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300">
                Active
              </Badge>
            </div>

            <div className="profileInfoList">
              <ProfileInfoItem icon={Mail} label="Email" value={currentUser.email || '-'} />
              <ProfileInfoItem icon={Phone} label="Telepon" value={currentUser.phone || '-'} />
              <ProfileInfoItem icon={Building} label="Cabang" value={userBranch?.name || 'Cabang Belum Diatur'} />
              <ProfileInfoItem icon={MapPin} label="Lokasi" value={userBranch?.location || 'Lokasi Tidak Diketahui'} />
            </div>
          </div>
        </section>

        <section className="profileMainStack">
          <div className="profilePanel">
            <div className="profilePanelHeader">
              <User className="h-5 w-5 text-blue-600 dark:text-blue-300" />
              <div>
                <h3>Informasi Pribadi</h3>
                <p>Data akun mengikuti konfigurasi administrator.</p>
              </div>
            </div>

            <div className="profileFieldGrid">
              <ProfileField id="name" label="Nama Lengkap" value={formData.name} helper="Nama tidak dapat diubah. Hubungi Administrator." />
              <ProfileField id="email" label="Email Address" value={formData.email} helper="Email tidak dapat diubah. Hubungi Administrator." />
              <ProfileField id="phone" label="Nomor Telepon" value={formData.phone || '-'} helper="Nomor telepon tidak dapat diubah. Hubungi Administrator." />
              <ProfileField id="role" label="Role / Jabatan" value={currentUser.role || ''} helper="Role tidak dapat diubah sendiri. Hubungi Administrator." />
            </div>
          </div>

          <div className="profilePanel">
            <div className="profilePanelHeader">
              <Settings className="h-5 w-5 text-slate-500 dark:text-slate-300" />
              <div>
                <h3>Pengaturan Aplikasi</h3>
                <p>Preferensi tampilan dan sesi login.</p>
              </div>
            </div>

            <div className="profileSettingsGrid">
              <div className="profileSettingRow">
                <div className="profileSettingLabel">
                  <span>{isDark ? <Moon className="h-4 w-4 text-blue-500" /> : <Sun className="h-4 w-4 text-orange-500" />}</span>
                  <div>
                    <strong>Tampilan</strong>
                    <small>Atur tema aplikasi.</small>
                  </div>
                </div>
                <div className="profileThemeSwitch">
                  <button type="button" onClick={() => setTheme('light')} className={!isDark ? 'isActive' : ''} aria-label="Gunakan tema terang">
                    <Sun className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => setTheme('dark')} className={isDark ? 'isActive' : ''} aria-label="Gunakan tema gelap">
                    <Moon className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="profileSettingRow profileLogoutRow">
                <div className="profileSettingLabel">
                  <span><LogOut className="h-4 w-4 text-rose-500" /></span>
                  <div>
                    <strong>Keluar Aplikasi</strong>
                    <small>Bersihkan sesi browser dan kembali ke login.</small>
                  </div>
                </div>
                <Button variant="destructive" className="profileLogoutButton" onClick={handleLogout}>
                  <LogOut className="h-4 w-4" />
                  Keluar
                  <ChevronRight className="h-4 w-4 opacity-70" />
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </OperationalPageShell>
  );
};

type ProfileInfoItemProps = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
};

function ProfileInfoItem({ icon: Icon, label, value }: ProfileInfoItemProps) {
  return (
    <div className="profileInfoItem">
      <Icon className="h-4 w-4" />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

type ProfileFieldProps = {
  id: string;
  label: string;
  value: string;
  helper: string;
};

function ProfileField({ id, label, value, helper }: ProfileFieldProps) {
  return (
    <div className="profileField">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} disabled />
      <p>{helper}</p>
    </div>
  );
}
