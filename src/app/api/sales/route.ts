import { NextRequest } from "next/server";
import { listSales, recordSale } from "@/lib/services/sales";
import { readJson, zodFail } from "@/lib/api";

/** GET /api/sales?limit=&payment_status= — invoice list. */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const limit = sp.get("limit");
  const paymentStatus = sp.get("payment_status");
  const input: Record<string, unknown> = {};
  if (limit) input.limit = Number(limit);
  if (paymentStatus === "paid" || paymentStatus === "unpaid") input.payment_status = paymentStatus;
  const res = listSales(input);
  return Response.json(res, { status: res.success ? 200 : 400 });
}

/** POST /api/sales — record a sale (Rule 7: atomic invoice + stock + cash). */
export async function POST(req: NextRequest) {
  const parsed = await readJson(req);
  if (!parsed.ok) return parsed.res;
  try {
    const dryRun = (parsed.body as { dry_run?: boolean } | null)?.dry_run === true;
    const res = recordSale(parsed.body, { dryRun });
    return Response.json(res, { status: res.success ? (dryRun ? 200 : 201) : 400 });
  } catch (err) {
    return zodFail("record_sale", err as import("zod").ZodError);
  }
}
