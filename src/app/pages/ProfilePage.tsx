import React, { useState, useEffect } from 'react';
import { 
  User, Mail, Phone, MapPin, Building, Loader2, 
  Moon, Sun, LogOut, Monitor, Settings, ChevronRight
} from 'lucide-react';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { useMasterData } from './master-data/context';
import { useTheme } from "next-themes";
import { supabase } from '../../lib/supabaseClient';
import { toast } from 'sonner';
import profileBg from "@/assets/1c0f2be78a20a7de41a366de35a8cc1a2a972f7c.png";

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

  // Sync form data when currentUser is loaded
  useEffect(() => {
    if (currentUser) {
      setFormData(prev => ({
        ...prev,
        name: currentUser.name || '',
        email: currentUser.email || '',
        phone: currentUser.phone || ''
      }));
    }
  }, [currentUser]);

  // Derive Branch Info
  const userBranch = branches.find(b => b.id === currentUser?.branchId);

  const handleLogout = async () => {
    const loadingToast = toast.loading('Sedang keluar...');
    try {
      // Clean up local storage first to prevent persistent sessions
      // Supabase uses 'sb-[project-ref]-auth-token' usually, but clearing all is safer for logout
      localStorage.clear();
      sessionStorage.clear();
      
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      toast.dismiss(loadingToast);
      // Force reload to ensure clean slate
      window.location.href = '/';
    }
  };

  if (!currentUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-4" />
        <p className="text-slate-500">Memuat data profil...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 w-full max-w-5xl mx-auto min-h-screen bg-slate-50/50 dark:bg-slate-950 transition-colors duration-300 pb-24 lg:pb-8">
      
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Profil Saya</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Kelola informasi akun dan preferensi aplikasi.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: User Info Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden transition-all duration-300">
            <div className="h-32 relative bg-blue-600">
              <img src={profileBg} alt="Profile Background" className="w-full h-full object-cover object-center" />
              <div className="absolute -bottom-12 left-1/2 -translate-x-1/2">
                <div className="relative group">
                  <div className="h-24 w-24 rounded-full border-4 border-white dark:border-slate-800 bg-white dark:bg-slate-800 overflow-hidden shadow-lg">
                    {currentUser?.avatar ? (
                      <img src={currentUser.avatar} alt="Profile" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-300 text-2xl font-bold">
                        {currentUser?.name?.substring(0, 2).toUpperCase() || 'US'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="pt-16 pb-6 px-6 text-center">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{currentUser?.name}</h2>
              <div className="flex items-center justify-center gap-2 mt-2">
                <Badge variant="secondary" className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-100 border-blue-100 dark:border-blue-800">
                  {currentUser?.role || 'User'}
                </Badge>
                <Badge variant="outline" className="text-green-600 dark:text-green-400 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/30">
                  Active
                </Badge>
              </div>
              
              <div className="mt-6 space-y-3 text-sm text-left border-t border-slate-100 dark:border-slate-700 pt-6">
                <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                  <Mail className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                  <span>{currentUser?.email}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                  <Phone className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                  <span>{currentUser?.phone || '-'}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                  <Building className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                  <span>{userBranch?.name || 'Cabang Belum Diatur'}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                  <MapPin className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                  <span>{userBranch?.location || 'Lokasi Tidak Diketahui'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Settings Card */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
             <div className="flex items-center gap-2 mb-4">
                <Settings className="w-5 h-5 text-slate-500" />
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">Pengaturan Aplikasi</h3>
             </div>
             
             <div className="space-y-4">
                {/* Theme Toggle */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700">
                   <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-white dark:bg-slate-800 shadow-sm">
                        {isDark ? <Moon className="w-4 h-4 text-blue-500" /> : <Sun className="w-4 h-4 text-orange-500" />}
                      </div>
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Tampilan</span>
                   </div>
                   <div className="flex gap-1 bg-slate-200 dark:bg-slate-800 rounded-lg p-1">
                      <button 
                        onClick={() => setTheme('light')}
                        className={`p-1.5 rounded-md transition-all ${!isDark ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}
                      >
                         <Sun className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => setTheme('dark')}
                        className={`p-1.5 rounded-md transition-all ${isDark ? 'bg-slate-700 shadow text-white' : 'text-slate-500'}`}
                      >
                         <Moon className="w-4 h-4" />
                      </button>
                   </div>
                </div>

                {/* Logout Button */}
                <Button 
                   variant="destructive" 
                   className="w-full justify-between"
                   onClick={handleLogout}
                >
                   <span className="flex items-center gap-2">
                     <LogOut className="w-4 h-4" />
                     Keluar Aplikasi
                   </span>
                   <ChevronRight className="w-4 h-4 opacity-50" />
                </Button>
             </div>
          </div>
        </div>

        {/* Right Column: Forms */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* General Info Form */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 transition-all duration-300">
            <div className="flex items-center gap-2 mb-6">
              <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Informasi Pribadi</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-slate-700 dark:text-slate-300">
                  Nama Lengkap
                </Label>
                <Input 
                  id="name" 
                  value={formData.name} 
                  disabled
                  className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                />
                <p className="text-[10px] text-slate-400 dark:text-slate-500">Nama tidak dapat diubah. Hubungi Administrator.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-700 dark:text-slate-300">
                  Email Address
                </Label>
                <Input 
                  id="email" 
                  value={formData.email} 
                  disabled
                  className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                />
                <p className="text-[10px] text-slate-400 dark:text-slate-500">Email tidak dapat diubah. Hubungi Administrator.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-slate-700 dark:text-slate-300">Nomor Telepon</Label>
                <Input 
                  id="phone" 
                  value={formData.phone} 
                  disabled
                  className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                />
                 <p className="text-[10px] text-slate-400 dark:text-slate-500">Nomor telepon tidak dapat diubah. Hubungi Administrator.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="role" className="text-slate-700 dark:text-slate-300">Role / Jabatan</Label>
                <Input 
                  id="role" 
                  value={currentUser?.role || ''} 
                  disabled 
                  className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                />
                <p className="text-[10px] text-slate-400 dark:text-slate-500">Role tidak dapat diubah sendiri. Hubungi Administrator.</p>
              </div>
            </div>
            

          </div>

        </div>
      </div>
    </div>
  );
};
