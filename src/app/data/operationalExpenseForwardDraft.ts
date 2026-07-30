export const OPERATIONAL_EXPENSE_FORWARD_DRAFT_KEY = 'rhi:operational-expense-forward-draft:v1';

export type OperationalExpenseForwardDraft = {
  source: 'operational-report-transaction';
  source_type: 'manual' | 'cash_out_forward';
  report_id?: string;
  transaction_id: string;
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
