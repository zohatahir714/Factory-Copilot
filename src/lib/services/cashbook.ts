import { z } from "zod";
import { ok, type ToolResponse } from "@/lib/responses";
import { getStore } from "./store";
import { money } from "@/lib/format";

/**
 * CASHBOOK SERVICE — cash position, ledger and expenses.
 * Cash truth = cashbook income − expense (PRD user story 17).
 */

export const RecordExpenseInput = z.object({
  amount: z.number().positive(),
  category: z.enum(["utilities", "salaries", "rent", "transport", "other"]),
  description: z.string().optional(),
});

export const ListCashbookInput = z.object({ limit: z.number().int().positive().max(500).optional() });

export async function cashTotals() {
  const entries = await getStore().listCashbook();
  let income = 0;
  let expense = 0;
  for (const e of entries) {
    if (e.type === "income") income += e.amount;
    else expense += e.amount;
  }
  return { income, expense, balance: income - expense };
}

export async function getCashPosition(): Promise<ToolResponse> {
  const { balance } = await cashTotals();
  return ok("get_cash_balance", { cash_position: balance, display: money(balance), as_of: new Date().toISOString() });
}

export async function listCashbook(input: unknown): Promise<ToolResponse> {
  const { limit } = ListCashbookInput.parse(input ?? {});
  const store = getStore();
  const rows = (await store.listCashbook()).slice().sort((a, b) => b.created_at.localeCompare(a.created_at));
  const entries = (limit ? rows.slice(0, limit) : rows).map((e) => ({
    ...e,
    amount_signed: e.type === "income" ? e.amount : -e.amount,
    amount_display: `${e.type === "income" ? "+" : "−"} ${money(e.amount)}`,
  }));
  const totals = await cashTotals();
  return ok("list_cashbook", {
    balance: totals.balance,
    balance_display: money(totals.balance),
    income_total: totals.income,
    income_display: money(totals.income),
    expense_total: totals.expense,
    expense_display: money(totals.expense),
    count: entries.length,
    entries,
  });
}

export async function recordExpense(input: unknown, opts?: { dryRun?: boolean }): Promise<ToolResponse> {
  const parsed = RecordExpenseInput.parse(input);
  if (opts?.dryRun) {
    return ok("record_expense", {
      pending_confirmation: true,
      summary: `Record expense of ${money(parsed.amount)} (${parsed.category})?`,
      draft: parsed,
    });
  }
  const store = getStore();
  const entry = await store.insertCashEntry({
    type: "expense",
    amount: parsed.amount,
    category: parsed.category,
    description: parsed.description ?? parsed.category,
  });
  const { balance } = await cashTotals();
  return ok("record_expense", {
    entry_id: entry.id,
    amount: entry.amount,
    category: entry.category,
    new_cash_position: balance,
    cash_display: money(balance),
  });
}
