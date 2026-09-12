import { NextRequest } from "next/server";
import { createPO, listPOs } from "@/lib/services/purchase";
import { readJson, zodFail } from "@/lib/api";

/** GET /api/purchase-orders?status=pending|received */
export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status");
  const res = await listPOs(status ? { status: status as "pending" | "received" } : {});
  return Response.json(res, { status: res.success ? 200 : 400 });
}

/** POST /api/purchase-orders — create PO (prices + tax computed server-side). */
export async function POST(req: NextRequest) {
  const parsed = await readJson(req);
  if (!parsed.ok) return parsed.res;
  try {
    const res = await createPO(parsed.body);
    return Response.json(res, { status: res.success ? 201 : 400 });
  } catch (err) {
    return zodFail("create_purchase_order", err as import("zod").ZodError);
  }
}
