export const OPERATIONAL_EXPENSE_FORWARD_DRAFT_KEY = 'rhi:operational-expense-forward-draft:v1';

export type OperationalExpenseForwardDraft = {
  source: 'operational-report-transaction' | 'recurring-expense';
  source_type: 'manual' | 'cash_out_forward' | 'recurring';
  report_id?: string;
  transaction_id: string;
  recurring_expense_id?: string;
  period_key?: string;
  due_date?: string;
  expense_date: string;
  branch_id?: string;
  category: string;
  subcategory?: string;
  vendor_name?: string;
  description: string;
  amount: string;
  payment_source?: string;
  source_ref?: string;
  notes?: string;
  auto_save?: boolean;
  created_at: string;
};
