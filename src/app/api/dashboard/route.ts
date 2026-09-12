import { NextRequest } from "next/server";
import { businessSummary, taxReport } from "@/lib/services/reports";

/**
 * GET /api/dashboard — KPI block for the dashboard (PRD §17.2):
 * today's sales, cash, inventory value, low stock, pending POs, receivables.
 */
export async function GET() {
  const res = businessSummary();
  return Response.json(res, { status: res.success ? 200 : 500 });
}

/** Kept out of the way: monthly tax report is served from /api/reports/tax. */
export async function POST(req: NextRequest) {
  void taxReport;
  return Response.json({ success: false, error: { code: "VALIDATION_ERROR", message: "Use GET /api/reports/tax?month=YYYY-MM" } }, { status: 400 });
}
