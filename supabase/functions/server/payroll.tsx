import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getRequesterAccessContext, hasEffectivePermission, type RequesterAccessContext } from "./requester_access.ts";

const app = new Hono();

// Handle OPTIONS explicitly to ensure preflight works
app.options("/*", () => new Response(null, { status: 204 }));

const createAdminClient = () =>
    createClient(
        Deno.env.get("SUPABASE_URL") || "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    );

type AuthError = { error: string };
type AuthSuccess = {
    user: any;
    role: string;
    profileName: string;
    requester: RequesterAccessContext;
    supabase: ReturnType<typeof createAdminClient>;
};
type AuthResult = AuthError | AuthSuccess;

const isAuthError = (auth: AuthResult): auth is AuthError => "error" in auth;

// Helper to check Auth using the shared permission engine.
const checkAuth = async (req: Request): Promise<AuthResult> => {
    const requester = await getRequesterAccessContext(req.headers);
    if (!requester) return { error: "Session login tidak valid. Silakan login ulang." };

    return {
        user: requester.authUser,
        role: requester.role || "Unknown",
        profileName: requester.actorName,
        requester,
        supabase: createAdminClient(),
    };
};

const toAmount = (value: unknown) => Math.max(0, Math.round(Number(value) || 0));
const toText = (value: unknown) => String(value || '').trim();
const toBoolean = (value: unknown) => value === true;

const requirePayrollManage = async (req: Request) => {
    const auth = await checkAuth(req);
    if (isAuthError(auth)) return { auth: null, response: { error: auth.error, status: 401 } };
    if (!hasEffectivePermission(auth.requester, "payroll.manage")) {
        return { auth, response: { error: "Forbidden", status: 403 } };
    }
    return { auth, response: null };
};

async function upsertManualPeriodDeduction(
    supabase: ReturnType<typeof createAdminClient>,
    userId: string,
    periodKey: string,
    amount: number,
    note: string,
    actorId: string,
) {
    if (!userId || !/^\d{4}-\d{2}$/.test(periodKey)) {
        throw new Error("Data kasbon periode tidak valid");
    }

    const { data: existing, error: existingError } = await supabase
        .from('payroll_deductions')
        .select('id')
        .eq('user_id', userId)
        .eq('period_key', periodKey)
        .eq('source_type', 'manual')
        .eq('source_ref', 'payroll-manual')
        .eq('status', 'active')
        .maybeSingle();

    if (existingError) throw existingError;

    if (amount > 0) {
        const payload = {
            user_id: userId,
            period_key: periodKey,
            amount,
            note,
            status: 'active',
            source_type: 'manual',
            source_ref: 'payroll-manual',
            updated_by: actorId,
            ...(existing?.id ? {} : { created_by: actorId }),
        };

        const result = existing?.id
            ? await supabase.from('payroll_deductions').update(payload).eq('id', existing.id)
            : await supabase.from('payroll_deductions').insert(payload);

        if (result.error) throw result.error;
        return;
    }

    if (existing?.id) {
        const { error } = await supabase
            .from('payroll_deductions')
            .update({ status: 'void', updated_by: actorId })
            .eq('id', existing.id);

        if (error) throw error;
    }
}

// GET: Fetch Payroll Data securely filtered
app.get("/data", async (c) => {
    try {
        const auth = await checkAuth(c.req.raw);
        if (isAuthError(auth)) return c.json({ error: auth.error }, 401);
        if (!hasEffectivePermission(auth.requester, "payroll.view")) return c.json({ error: "Forbidden" }, 403);
        
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
                periodDeductionData: [],
                expenseData: [], 
                reportData: [],
                payrollRunData: [],
                payrollRunItemData: [],
            });
        }

        // 3. Fetch from Postgres tables but only for allowed user IDs
        const [salaryRes, kpiRes, assignRes, periodDeductionRes, expenseRes, reportRes, payrollRunRes] = await Promise.all([
            supabase.from('salary_profiles').select('*').in('user_id', allowedUserIds),
            supabase.from('kpi_library').select('*'), // KPI library is public info or target-based? Usually global.
            supabase.from('employee_kpi_assignments').select('*').in('user_id', allowedUserIds),
            supabase.from('payroll_deductions').select('*').in('user_id', allowedUserIds).eq('status', 'active'),
            supabase.from('recurring_expenses').select('*'), // Global expenses
            supabase.from('technician_daily_reports').select('*').in('technician_id', allowedUserIds),
            supabase.from('payroll_runs').select('*').neq('status', 'void').order('period_key', { ascending: false })
        ]);

        const payrollRuns = payrollRunRes.data || [];
        const payrollRunIds = payrollRuns.map((run: any) => run.id).filter(Boolean);
        const payrollRunItemRes = payrollRunIds.length
            ? await supabase
                .from('payroll_run_items')
                .select('*')
                .in('payroll_run_id', payrollRunIds)
                .order('employee_name', { ascending: true })
            : { data: [], error: null };

        return c.json({
            allowedUserIds,
            salaryData: salaryRes.data || [],
            kpiData: kpiRes.data || [],
            assignData: assignRes.data || [],
            periodDeductionData: periodDeductionRes.data || [],
            expenseData: expenseRes.data || [],
            reportData: reportRes.data || [],
            payrollRunData: payrollRuns,
            payrollRunItemData: payrollRunItemRes.data || []
        });

    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

app.post("/salary", async (c) => {
    try {
        const { auth, response } = await requirePayrollManage(c.req.raw);
        if (response) return c.json({ error: response.error }, response.status);
        if (!auth) return c.json({ error: "Unauthorized" }, 401);

        const body = await c.req.json();
        const userId = toText(body.user_id || body.userId);
        const periodKey = toText(body.period_key || body.periodKey);
        const selectedKpis = Array.isArray(body.selected_kpis || body.selectedKpis)
            ? (body.selected_kpis || body.selectedKpis).map(toText).filter(Boolean)
            : [];

        if (!userId) return c.json({ error: "User payroll wajib diisi" }, 400);
        if (!/^\d{4}-\d{2}$/.test(periodKey)) return c.json({ error: "Periode payroll tidak valid" }, 400);

        const salaryPayload = {
            user_id: userId,
            basic_salary: toAmount(body.basic_salary || body.basicSalary),
            allowance_fixed: toAmount(body.allowance_fixed || body.allowanceFixed),
            tool_allowance: toAmount(body.tool_allowance || body.toolAllowance),
            quota: toAmount(body.quota),
            deductions: toAmount(body.deductions),
        };

        const { data: salary, error: salaryError } = await auth.supabase
            .from('salary_profiles')
            .upsert(salaryPayload, { onConflict: 'user_id' })
            .select()
            .single();

        if (salaryError) throw salaryError;

        const { error: deleteAssignmentsError } = await auth.supabase
            .from('employee_kpi_assignments')
            .delete()
            .eq('user_id', userId);

        if (deleteAssignmentsError) throw deleteAssignmentsError;

        if (selectedKpis.length > 0) {
            const { error: insertAssignmentsError } = await auth.supabase
                .from('employee_kpi_assignments')
                .insert(selectedKpis.map((kpiId: string) => ({ user_id: userId, kpi_id: kpiId })));

            if (insertAssignmentsError) throw insertAssignmentsError;
        }

        await upsertManualPeriodDeduction(
            auth.supabase,
            userId,
            periodKey,
            toAmount(body.period_deduction_amount || body.periodDeductionAmount),
            toText(body.period_deduction_note || body.periodDeductionNote),
            auth.user.id,
        );

        return c.json({ salary, selectedKpiCount: selectedKpis.length });
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

app.post("/salary/bulk", async (c) => {
    try {
        const { auth, response } = await requirePayrollManage(c.req.raw);
        if (response) return c.json({ error: response.error }, response.status);
        if (!auth) return c.json({ error: "Unauthorized" }, 401);

        const body = await c.req.json();
        const userIds = Array.isArray(body.user_ids || body.userIds)
            ? (body.user_ids || body.userIds).map(toText).filter(Boolean)
            : [];
        const periodKey = toText(body.period_key || body.periodKey);

        if (!userIds.length) return c.json({ error: "Pilih minimal satu karyawan" }, 400);
        if (!/^\d{4}-\d{2}$/.test(periodKey)) return c.json({ error: "Periode payroll tidak valid" }, 400);

        const salary = body.salary || {};
        const fieldsToUpdate = salary.fields_to_update || salary.fieldsToUpdate || {};
        const shouldUpdateSalary = toBoolean(body.update_salary || body.updateSalary);

        if (shouldUpdateSalary) {
            const { data: existingProfiles, error: existingProfilesError } = await auth.supabase
                .from('salary_profiles')
                .select('*')
                .in('user_id', userIds);

            if (existingProfilesError) throw existingProfilesError;

            const profileMap = new Map((existingProfiles || []).map((profile: any) => [profile.user_id, profile]));
            const profilesToUpsert = userIds.map((userId: string) => {
                const current = profileMap.get(userId) || {};
                return {
                    user_id: userId,
                    basic_salary: toBoolean(fieldsToUpdate.basic) ? toAmount(salary.basic) : toAmount(current.basic_salary),
                    allowance_fixed: toBoolean(fieldsToUpdate.allowance) ? toAmount(salary.allowance) : toAmount(current.allowance_fixed),
                    tool_allowance: toBoolean(fieldsToUpdate.tool) ? toAmount(salary.tool) : toAmount(current.tool_allowance),
                    quota: toBoolean(fieldsToUpdate.quota) ? toAmount(salary.quota) : toAmount(current.quota),
                    deductions: toBoolean(fieldsToUpdate.deduction) ? toAmount(salary.deduction) : toAmount(current.deductions),
                };
            });

            const { error: salaryError } = await auth.supabase
                .from('salary_profiles')
                .upsert(profilesToUpsert, { onConflict: 'user_id' });

            if (salaryError) throw salaryError;
        }

        if (toBoolean(body.update_period_deduction || body.updatePeriodDeduction)) {
            const deduction = body.period_deduction || body.periodDeduction || {};
            for (const userId of userIds) {
                await upsertManualPeriodDeduction(
                    auth.supabase,
                    userId,
                    periodKey,
                    toAmount(deduction.amount),
                    toText(deduction.note),
                    auth.user.id,
                );
            }
        }

        if (toBoolean(body.update_kpi || body.updateKpi)) {
            const kpi = body.kpi || {};
            const selectedKpis = Array.isArray(kpi.selected_kpis || kpi.selectedKpis)
                ? (kpi.selected_kpis || kpi.selectedKpis).map(toText).filter(Boolean)
                : [];
            const mode = toText(kpi.mode) === 'append' ? 'append' : 'replace';

            if (mode === 'replace') {
                const { error: deleteError } = await auth.supabase
                    .from('employee_kpi_assignments')
                    .delete()
                    .in('user_id', userIds);

                if (deleteError) throw deleteError;
            }

            if (selectedKpis.length > 0) {
                const assignments = userIds.flatMap((userId: string) => (
                    selectedKpis.map((kpiId: string) => ({ user_id: userId, kpi_id: kpiId }))
                ));

                const { error: assignmentError } = await auth.supabase
                    .from('employee_kpi_assignments')
                    .upsert(assignments, { onConflict: 'user_id,kpi_id', ignoreDuplicates: true });

                if (assignmentError) throw assignmentError;
            }
        }

        return c.json({ updatedUserCount: userIds.length });
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

app.post("/kpis", async (c) => {
    try {
        const { auth, response } = await requirePayrollManage(c.req.raw);
        if (response) return c.json({ error: response.error }, response.status);
        if (!auth) return c.json({ error: "Unauthorized" }, 401);

        const body = await c.req.json();
        const name = toText(body.name);
        if (!name) return c.json({ error: "Nama KPI wajib diisi" }, 400);

        const payload = {
            ...(toText(body.id) ? { id: toText(body.id) } : {}),
            name,
            type: toText(body.type) || 'per_order',
            amount: toAmount(body.amount),
            target_field: toText(body.target_field || body.targetField),
            description: toText(body.description),
            config: body.config && typeof body.config === 'object' ? body.config : {},
        };

        const { data, error } = await auth.supabase
            .from('kpi_library')
            .upsert(payload)
            .select()
            .single();

        if (error) throw error;
        return c.json({ data });
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

app.delete("/kpis/:id", async (c) => {
    try {
        const { auth, response } = await requirePayrollManage(c.req.raw);
        if (response) return c.json({ error: response.error }, response.status);
        if (!auth) return c.json({ error: "Unauthorized" }, 401);

        const id = toText(c.req.param("id"));
        if (!id) return c.json({ error: "KPI tidak ditemukan" }, 400);

        const { error } = await auth.supabase.from('kpi_library').delete().eq('id', id);
        if (error) throw error;

        return c.json({ success: true });
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

app.post("/runs", async (c) => {
    try {
        const auth = await checkAuth(c.req.raw);
        if (isAuthError(auth)) return c.json({ error: auth.error }, 401);
        if (!hasEffectivePermission(auth.requester, "payroll.manage")) return c.json({ error: "Forbidden" }, 403);

        const body = await c.req.json();
        const run = body?.run || {};
        const items = Array.isArray(body?.items) ? body.items : [];
        const periodKey = toText(run.period_key);

        if (!/^\d{4}-\d{2}$/.test(periodKey)) {
            return c.json({ error: "Invalid payroll period" }, 400);
        }
        if (!items.length) {
            return c.json({ error: "Payroll snapshot item is empty" }, 400);
        }

        const { data: existingRun, error: existingError } = await auth.supabase
            .from('payroll_runs')
            .select('id, status')
            .eq('period_key', periodKey)
            .neq('status', 'void')
            .maybeSingle();

        if (existingError) throw existingError;
        if (existingRun?.status === 'posted') {
            return c.json({ error: "Payroll period already posted" }, 409);
        }

        const runPayload = {
            ...(existingRun?.id ? { id: existingRun.id } : {}),
            period_key: periodKey,
            period_label: toText(run.period_label),
            cutoff_start: run.cutoff_start,
            cutoff_end: run.cutoff_end,
            employee_count: Math.max(0, Math.round(Number(run.employee_count) || items.length)),
            fixed_cost: toAmount(run.fixed_cost),
            bonus_total: toAmount(run.bonus_total),
            fixed_deductions_total: toAmount(run.fixed_deductions_total),
            period_deductions_total: toAmount(run.period_deductions_total),
            recurring_expense_total: toAmount(run.recurring_expense_total),
            take_home_total: toAmount(run.take_home_total),
            grand_total: toAmount(run.grand_total),
            status: 'locked',
            locked_at: new Date().toISOString(),
            locked_by: auth.user.id,
            locked_by_name: auth.profileName,
            notes: toText(run.notes),
            updated_by: auth.user.id,
            updated_by_name: auth.profileName,
            ...(existingRun?.id ? {} : {
                created_by: auth.user.id,
                created_by_name: auth.profileName,
            }),
        };

        const { data: runData, error: runError } = await auth.supabase
            .from('payroll_runs')
            .upsert(runPayload, { onConflict: 'period_key' })
            .select()
            .single();

        if (runError) throw runError;

        const { error: deleteError } = await auth.supabase
            .from('payroll_run_items')
            .delete()
            .eq('payroll_run_id', runData.id);

        if (deleteError) throw deleteError;

        const itemPayloads = items.map((item: any) => ({
            payroll_run_id: runData.id,
            user_id: toText(item.user_id),
            employee_name: toText(item.employee_name),
            employee_role: toText(item.employee_role),
            basic_salary: toAmount(item.basic_salary),
            allowance_fixed: toAmount(item.allowance_fixed),
            tool_allowance: toAmount(item.tool_allowance),
            quota: toAmount(item.quota),
            fixed_deductions: toAmount(item.fixed_deductions),
            period_deductions: toAmount(item.period_deductions),
            bonus: toAmount(item.bonus),
            take_home_pay: toAmount(item.take_home_pay),
            order_count: Math.max(0, Math.round(Number(item.order_count) || 0)),
            unit_count: Math.max(0, Math.round(Number(item.unit_count) || 0)),
            kpi_period_label: toText(item.kpi_period_label),
            kpi_snapshot: Array.isArray(item.kpi_snapshot) ? item.kpi_snapshot : [],
        }));

        const { error: itemError } = await auth.supabase
            .from('payroll_run_items')
            .insert(itemPayloads);

        if (itemError) throw itemError;

        return c.json({ run: runData, itemCount: itemPayloads.length });
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

app.post("/runs/:id/post", async (c) => {
    try {
        const auth = await checkAuth(c.req.raw);
        if (isAuthError(auth)) return c.json({ error: auth.error }, 401);
        if (!hasEffectivePermission(auth.requester, "payroll.manage")) return c.json({ error: "Forbidden" }, 403);

        const runId = c.req.param("id");
        const { data: run, error: runError } = await auth.supabase
            .from('payroll_runs')
            .select('*')
            .eq('id', runId)
            .neq('status', 'void')
            .single();

        if (runError) throw runError;
        if (!run) return c.json({ error: "Payroll run not found" }, 404);
        if (toAmount(run.take_home_total) <= 0) {
            return c.json({ error: "Payroll amount is empty" }, 400);
        }

        const sourceRef = `payroll:${run.period_key}`;
        const ledgerPayload = {
            expense_date: run.cutoff_end,
            period_key: run.period_key,
            branch_id: null,
            branch_name: '',
            category: 'Beban Operasional',
            subcategory: 'Gaji & Komisi',
            vendor_name: 'Payroll',
            description: `Payroll periode ${run.period_label || run.period_key}`,
            amount: toAmount(run.take_home_total),
            currency: 'IDR',
            payment_source: 'Payroll',
            source_type: 'payroll',
            source_ref: sourceRef,
            notes: [
                `Dibuat dari snapshot payroll ${run.period_key}.`,
                `Karyawan: ${run.employee_count}.`,
                `Bonus KPI: Rp ${Number(run.bonus_total || 0).toLocaleString('id-ID')}.`,
                `Kasbon periode: Rp ${Number(run.period_deductions_total || 0).toLocaleString('id-ID')}.`,
            ].join(' '),
            status: 'active',
            updated_by: auth.user.id,
            updated_by_name: auth.profileName,
        };

        const { data: existingLedger, error: existingLedgerError } = await auth.supabase
            .from('operational_expense_ledger')
            .select('id')
            .eq('source_type', 'payroll')
            .eq('source_ref', sourceRef)
            .eq('status', 'active')
            .maybeSingle();

        if (existingLedgerError) throw existingLedgerError;

        const ledgerResult = existingLedger?.id
            ? await auth.supabase
                .from('operational_expense_ledger')
                .update(ledgerPayload)
                .eq('id', existingLedger.id)
                .select('id')
                .single()
            : await auth.supabase
                .from('operational_expense_ledger')
                .insert({
                    ...ledgerPayload,
                    created_by: auth.user.id,
                    created_by_name: auth.profileName,
                })
                .select('id')
                .single();

        if (ledgerResult.error) throw ledgerResult.error;

        const { data: updatedRun, error: updateError } = await auth.supabase
            .from('payroll_runs')
            .update({
                status: 'posted',
                operational_expense_id: ledgerResult.data.id,
                posted_at: new Date().toISOString(),
                posted_by: auth.user.id,
                posted_by_name: auth.profileName,
                updated_by: auth.user.id,
                updated_by_name: auth.profileName,
            })
            .eq('id', run.id)
            .select()
            .single();

        if (updateError) throw updateError;

        return c.json({ run: updatedRun, operationalExpenseId: ledgerResult.data.id });
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

export default app;
