import { NextRequest } from "next/server";
import { listSuppliers, createSupplier } from "@/lib/services/parties";
import { readJson, zodFail } from "@/lib/api";

/** GET /api/suppliers?q= */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? undefined;
  const res = listSuppliers(q ? { q } : {});
  return Response.json(res, { status: res.success ? 200 : 400 });
}

/** POST /api/suppliers */
export async function POST(req: NextRequest) {
  const parsed = await readJson(req);
  if (!parsed.ok) return parsed.res;
  try {
    const res = createSupplier(parsed.body);
    return Response.json(res, { status: res.success ? 201 : 400 });
  } catch (err) {
    return zodFail("create_supplier", err as import("zod").ZodError);
  }
}
