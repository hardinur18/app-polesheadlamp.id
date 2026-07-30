import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";
import { createClient } from "npm:@supabase/supabase-js@2";

const app = new Hono();

// Handle OPTIONS explicitly to ensure preflight works
app.options("/*", () => new Response(null, { status: 204 }));

const createAdminClient = () =>
    createClient(
        Deno.env.get("SUPABASE_URL") || "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    );

type AuthError = { error: string };
type AuthSuccess = { user: any; role: string; supabase: ReturnType<typeof createAdminClient> };
type AuthResult = AuthError | AuthSuccess;

const isAuthError = (auth: AuthResult): auth is AuthError => "error" in auth;

// Helper to check Auth using ANON KEY (verify they are actually a user)
const checkAuth = async (req: Request): Promise<AuthResult> => {
    let token = req.headers.get("x-client-token");
    if (!token) {
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) return { error: "Missing Authorization header" };
        token = authHeader.replace("Bearer ", "");
    }

    const supabase = createAdminClient();
    
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
        return { error: `Invalid token: ${error?.message || 'Unknown'}` };
    }

    // Get the user's role from profiles table
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    const role = profile?.role || 'Unknown';

    return { user, role, supabase };
};

// GET: Fetch Payroll Data securely filtered
app.get("/data", async (c) => {
    try {
        const auth = await checkAuth(c.req.raw);
        if (isAuthError(auth)) return c.json({ error: auth.error }, 401);
        
        const { role, supabase } = auth;

        // 1. Get global role settings to see which roles this user can see
        const settingsPayload = await kv.get("global_role_settings:1");
        const roleSettings = settingsPayload?.[role] || {};
        const visibleRoles = roleSettings.payroll_visible_roles || [];

        // 2. Fetch Users to map IDs to Roles
        const { data: usersData } = await supabase.from('profiles').select('id, role');
        const users = usersData || [];
        
        let allowedUserIds = users.filter((u: any) => visibleRoles.includes(u.role)).map((u: any) => u.id);

        // Owner can see everything
        if (role === 'Owner' || role === 'Super Admin') {
            allowedUserIds = users.map((u: any) => u.id);
        }

        if (allowedUserIds.length === 0) {
             return c.json({ 
                salaryData: [], 
                kpiData: [], 
                assignData: [], 
                expenseData: [], 
                reportData: [] 
            });
        }

        // 3. Fetch from Postgres tables but only for allowed user IDs
        const [salaryRes, kpiRes, assignRes, expenseRes, reportRes] = await Promise.all([
            supabase.from('salary_profiles').select('*').in('user_id', allowedUserIds),
            supabase.from('kpi_library').select('*'), // KPI library is public info or target-based? Usually global.
            supabase.from('employee_kpi_assignments').select('*').in('user_id', allowedUserIds),
            supabase.from('recurring_expenses').select('*'), // Global expenses
            supabase.from('technician_daily_reports').select('*').in('technician_id', allowedUserIds)
        ]);

        return c.json({
            allowedUserIds,
            salaryData: salaryRes.data || [],
            kpiData: kpiRes.data || [],
            assignData: assignRes.data || [],
            expenseData: expenseRes.data || [],
            reportData: reportRes.data || []
        });

    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

export default app;
