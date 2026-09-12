import { NextRequest } from "next/server";
import { listCustomers, createCustomer } from "@/lib/services/parties";
import { readJson, zodFail } from "@/lib/api";

/** GET /api/customers?q= */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? undefined;
  const res = await listCustomers(q ? { q } : {});
  return Response.json(res, { status: res.success ? 200 : 400 });
}

/** POST /api/customers */
export async function POST(req: NextRequest) {
  const parsed = await readJson(req);
  if (!parsed.ok) return parsed.res;
  try {
    const res = await createCustomer(parsed.body);
    return Response.json(res, { status: res.success ? 201 : 400 });
  } catch (err) {
    return zodFail("create_customer", err as import("zod").ZodError);
  }
}
