import { getTodayDateKey } from '../../dateKeys';

export const getDeferredBootstrapTablesForPath = (path: string) => {
  const normalizedPath = path.toLowerCase();
  const isTechnicianMobilePath = normalizedPath.startsWith('/technician/mobile');
  const tables = new Set<string>();

  const add = (...tableNames: string[]) => {
    tableNames.forEach((tableName) => tables.add(tableName));
  };

  if (
    normalizedPath.startsWith('/orders') ||
    normalizedPath.startsWith('/leads') ||
    normalizedPath.startsWith('/schedule') ||
    normalizedPath.startsWith('/monitoring') ||
    (normalizedPath.startsWith('/technician') && !isTechnicianMobilePath)
  ) {
    add('prospect_bookings', 'technician_schedules');
  }

  if (normalizedPath.startsWith('/leads')) {
    add('lead_social_contacts');
  }

  if (
    normalizedPath.startsWith('/orders') ||
    normalizedPath.startsWith('/leads') ||
    normalizedPath.startsWith('/technician') ||
    normalizedPath.startsWith('/whatsapp')
  ) {
    add('wa_templates');
  }

  if (
    normalizedPath.startsWith('/audit-logs') ||
    normalizedPath.startsWith('/reports') ||
    normalizedPath.startsWith('/finance')
  ) {
    add('audit_logs');
  }

  return tables;
};

export const shouldBootstrapAdPerformanceInputsForPath = (path: string) => {
  const normalizedPath = path.toLowerCase();
  return (
    normalizedPath.startsWith('/dashboard') ||
    normalizedPath.startsWith('/reports') ||
    normalizedPath.startsWith('/ads')
  );
};

export const getCurrentMonthDateRange = () => {
  const now = new Date();
  return {
    from: getTodayDateKey(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: getTodayDateKey(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
};
