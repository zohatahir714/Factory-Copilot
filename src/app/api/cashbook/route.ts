import { NextRequest } from "next/server";
import { getCashPosition, listCashbook, recordExpense } from "@/lib/services/cashbook";
import { readJson, zodFail } from "@/lib/api";

/** GET /api/cashbook?limit= — ledger with totals. */
export async function GET(req: NextRequest) {
  const limit = req.nextUrl.searchParams.get("limit");
  const res = await listCashbook(limit ? { limit: Number(limit) } : {});
  return Response.json(res, { status: res.success ? 200 : 400 });
}

/** POST /api/cashbook — record an expense. */
export async function POST(req: NextRequest) {
  const parsed = await readJson(req);
  if (!parsed.ok) return parsed.res;
  try {
    const dryRun = (parsed.body as { dry_run?: boolean } | null)?.dry_run === true;
    const res = await recordExpense(parsed.body, { dryRun });
    return Response.json(res, { status: res.success ? (dryRun ? 200 : 201) : 400 });
  } catch (err) {
    return zodFail("record_expense", err as import("zod").ZodError);
  }
}
void getCashPosition;
