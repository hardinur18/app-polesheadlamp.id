import { LayoutDashboard, ClipboardList, Calendar, User, Menu, Users, Megaphone, type LucideIcon } from 'lucide-react';
import { cn } from './ui/utils';
import { useMasterData } from '../pages/master-data/context';
import { usePermissions } from '../hooks/usePermissions';
import { PermissionKey } from '../data/permissions';
import { isAdvertiserRole, isTechnicianRole } from '../data/roleHelpers';

interface BottomNavProps {
  activeTab: string;
  onNavigate: (id: string) => void;
}

type BottomNavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
};

export function BottomNav({ activeTab, onNavigate }: BottomNavProps) {
  const { currentRole } = useMasterData();
  const { hasPermission } = usePermissions();
  const permissionMap: Partial<Record<string, PermissionKey>> = {
    dashboard: 'dashboard.view',
    'daily-ads': 'ads.view_daily',
    prospek: 'leads.view',
    orders: 'order.view',
    schedule: 'schedule.view',
    'teknisi-mobile': 'teknisi.view_mobile',
  };

  // Define nav items based on role
  let navItems: BottomNavItem[] = [];

  if (isTechnicianRole(currentRole)) {
      // Layout Khusus Teknisi (Fokus Lapangan)
      navItems = [
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'orders', label: 'Pesanan', icon: ClipboardList },
          { id: 'teknisi-mobile', label: 'Jadwal Saya', icon: Calendar },
          { id: 'profile', label: 'Profil', icon: User }, // Ganti Menu jadi Profil, hide sidebar
      ];
  } else if (isAdvertiserRole(currentRole)) {
      // Layout Khusus Advertiser (Tanpa Menu Sidebar)
      navItems = [
        { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
        { id: 'daily-ads', label: 'Iklan', icon: Megaphone },
        { id: 'prospek', label: 'Prospek', icon: Users },
        { id: 'orders', label: 'Pesanan', icon: ClipboardList },
        // Advertiser jarang akses jadwal teknisi, tapi kalau perlu bisa lewat Home -> Jadwal
        // Kita ganti Menu jadi Jadwal jika masih muat, atau hilangkan Menu
        { id: 'schedule', label: 'Jadwal', icon: Calendar }, 
      ];
  } else {
      // Layout Standard (Owner, Admin, Sales, dll)
      // Mengutamakan fitur Manajemen: Dashboard, Prospek, Pesanan, Jadwal
      navItems = [
        { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
        { id: 'prospek', label: 'Prospek', icon: Users },
        { id: 'orders', label: 'Pesanan', icon: ClipboardList },
        { id: 'schedule', label: 'Jadwal', icon: Calendar },
        { id: 'menu', label: 'Menu', icon: Menu },
      ];

      // Double check: If by any chance Advertiser falls here, remove Schedule
      if (isAdvertiserRole(currentRole)) {
          navItems = navItems.filter(item => item.id !== 'schedule');
      }
  }

  navItems = navItems.filter(item => {
    if (item.id === 'menu' || item.id === 'profile') {
      return true;
    }

    const permission = permissionMap[item.id];
    return permission ? hasPermission(permission) : true;
  });

  const technicianDock = isTechnicianRole(currentRole);

  return (
    <nav
      className={cn('mobileNavBar', technicianDock && 'technicianDock')}
      aria-label="Navbar aplikasi"
    >
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={cn('mobileNavItem', isActive && 'active')}
              aria-current={isActive ? 'page' : undefined}
            >
              <item.icon size={19} />
              <span>{item.label}</span>
            </button>
          );
        })}
    </nav>
  );
}
