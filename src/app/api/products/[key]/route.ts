import { NextRequest } from "next/server";
import { z } from "zod";
import { lookupProduct } from "@/lib/services/products";
import { jsonFail, zodFail } from "@/lib/api";

const ParamSchema = z.object({ key: z.string().min(1) });

/**
 * GET /api/products/[key] — one product by id, SKU or fuzzy name.
 * Route param is validated before it reaches the service.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = ParamSchema.parse((await params));
  const res = await lookupProduct({ product: key });
  if (!res.success && res.error?.code === "PRODUCT_NOT_FOUND") {
    return Response.json(res, { status: 404 });
  }
  return Response.json(res, { status: res.success ? 200 : 400 });
}
void jsonFail;
