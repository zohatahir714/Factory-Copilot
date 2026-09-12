import { NextRequest } from "next/server";
import { listProducts, createProduct } from "@/lib/services/products";
import { jsonFail, readJson, zodFail } from "@/lib/api";

/** GET /api/products?q= — list products (low_stock flags included). */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? undefined;
  const res = listProducts(q ? { q } : {});
  return Response.json(res, { status: res.success ? 200 : 400 });
}

/** POST /api/products — create a product (Rule 3: server-side mutation). */
export async function POST(req: NextRequest) {
  const parsed = await readJson(req);
  if (!parsed.ok) return parsed.res;
  try {
    const res = createProduct(parsed.body);
    return Response.json(res, { status: res.success ? 201 : 400 });
  } catch (err) {
    return zodFail("create_product", err as import("zod").ZodError);
  }
}
void jsonFail;
