/**
 * Agent runtime timing and state shape.
 *
 * Transcribed verbatim from PLAN.md §Shared Interfaces. Zoha and Sidra code
 * against these names.
 */
import type { AgentProposal, AuditEntry } from './types.ts';

/** How often the supervisor wakes and re-reads live state. */
export const AGENT_TICK_MS = 30_000;

export interface AgentRuntimeState {
  running: boolean;
  lastTickAt: string | null;
  proposals: AgentProposal[];
  audit: AuditEntry[];
}