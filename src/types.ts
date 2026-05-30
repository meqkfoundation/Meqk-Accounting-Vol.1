// Meqk Accounting Vol.1 Shared Type Definitions

export interface UserSession {
  id: string;
  email?: string;
  user_metadata?: Record<string, any>;
  created_at?: string;
}

export type ThemeType = "gold-luxury";

export const GLOBAL_TABLES = [
  "cash_types",
  "invoice_types",
  "occupations",
  "roles",
  "transaction_statuses",
  "regions"
];

export function isGlobalTable(tableName: string): boolean {
  return GLOBAL_TABLES.includes(tableName);
}
