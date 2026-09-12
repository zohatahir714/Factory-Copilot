import { NextRequest } from "next/server";
import { taxReport } from "@/lib/services/reports";

/** GET /api/reports/tax?month=YYYY-MM — GST-style summary with source references. */
export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
  const res = await taxReport({ month });
  return Response.json(res, { status: res.success ? 200 : 400 });
}
