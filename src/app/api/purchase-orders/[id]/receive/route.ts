import { z } from "zod";
import { previewReceive, receiveGoods } from "@/lib/services/purchase";

const BodySchema = z.object({ dry_run: z.boolean().optional() });

/**
 * POST /api/purchase-orders/[id]/receive — goods receipt (PRD user story 8/9).
 * { dry_run: true } returns the stock-change preview without committing;
 * default commits atomically: PO status + movements + stock cache.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = BodySchema.safeParse(await _req.json().catch(() => ({})));
  const dryRun = body.success ? body.data.dry_run === true : false;

  const res = dryRun ? previewReceive({ po_id: id }) : receiveGoods({ po_id: id });
  if (res.error?.code === "PO_NOT_FOUND") return Response.json(res, { status: 404 });
  return Response.json(res, { status: res.success ? 200 : 400 });
}
