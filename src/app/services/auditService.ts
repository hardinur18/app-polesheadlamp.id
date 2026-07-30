import { supabase } from '@/lib/supabaseClient';
import { buildMakeServerUrl } from './internal/functionsBaseUrl';
import { getSessionBackedEdgeHeaders } from './internal/sessionClientHeaders';

export interface AuditLog {
  id: string;
  created_at: string;
  user_id: string;
  user_name: string;
  user_role: string;
  action: string;
  entity: string;
  entity_id: string;
  details: string;
  metadata?: any;
}

// ── Send Telegram notification via Edge Function ──
// Bot token is stored server-side as Supabase secret — never exposed to client
const TELEGRAM_EDGE_FN = buildMakeServerUrl('/telegram/notify');

const sendTelegramNotification = async (payload: {
  action: string;
  entity: string;
  details: string;
  user_name: string;
  user_role: string;
}) => {
  try {
    const headers = await getSessionBackedEdgeHeaders({ includeJsonContentType: true });
    // Fire-and-forget: don't block the UI
    fetch(TELEGRAM_EDGE_FN, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    }).catch((err) => {
      console.error('Telegram notification failed:', err);
    });
  } catch (err) {
    console.error('Telegram notification failed:', err);
  }
};

export const logActivity = (
  user: { id: string; name: string; role: string },
  action: string,
  entity: string,
  details: string,
  entityId: string = '',
  metadata: any = {}
) => {
  // Run DB insert and Telegram notification in PARALLEL — don't block UI
  const payload = {
    user_id: user.id,
    user_name: user.name,
    user_role: user.role,
    action,
    entity,
    entity_id: entityId,
    details,
    metadata
  };

  // 1. Save to audit_logs (fire-and-forget)
  supabase.from('audit_logs').insert([payload]).then(({ error }) => {
    if (error) console.error("Failed to write audit log:", error.message);
  });

  // 2. Send Telegram instantly (fire-and-forget, parallel with DB)
  void sendTelegramNotification({
    action,
    entity,
    details,
    user_name: user.name,
    user_role: user.role,
  });
};

export const fetchAuditLogs = async (limit = 50) => {
    const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
    
    if (error) throw error;
    return data as AuditLog[];
};
