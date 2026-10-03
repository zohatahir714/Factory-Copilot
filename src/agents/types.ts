/**
 * Shared agent contracts.
 *
 * Transcribed verbatim from Hackathon-2 `PLAN.md` § Shared Interfaces.
 * All three tracks code against these types, so this file must match the plan
 * exactly. Landed here (rather than by Adil Task 1) so the Zoha track is not
 * blocked; it is additive and changes nothing if Adil later re-lands it.
 */

export type AgentId = 'inventory' | 'purchase' | 'accounting' | 'compliance' | 'supervisor';
export type AgentActionStatus = 'proposed' | 'approved' | 'rejected' | 'expired';

export interface AgentProposal {
  id: string;
  agentId: AgentId;
  title: string;                    // one line, shown in the approval queue
  rationale: string;                // WHY — plain language, judge-readable
  confidence: number;               // 0..1, computed by a real function, never a literal
  citations: string[];              // statutory refs, e.g. 'S.R.O. 345(I)/2024 §2'
  payload: Record<string, unknown>; // tool params, replayed verbatim on approval
  tool: 'create_purchase_order' | 'record_sale' | 'record_expense' | 'flag_anomaly';
  status: AgentActionStatus;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface AuditEntry {
  id: string;
  agentId: AgentId;
  action: string;
  detail: string;
  confidence: number;
  citations: string[];
  timestamp: string;
}