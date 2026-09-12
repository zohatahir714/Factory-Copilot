/**
 * Standard response envelope — PRD §23 / CONTRACTS §4.
 * Every tool, service and REST route returns this shape.
 */

export interface ToolError {
  code: ErrorCode;
  message: string;
  /** Optional did-you-mean list from the fuzzy name matcher (PRD §29). */
  suggestions?: string[];
}

export const ERROR_CODES = [
  "PRODUCT_NOT_FOUND",
  "CUSTOMER_NOT_FOUND",
  "SUPPLIER_NOT_FOUND",
  "PO_NOT_FOUND",
  "INSUFFICIENT_STOCK",
  "PO_ALREADY_RECEIVED",
  "JOURNAL_UNBALANCED",
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "RATE_LIMITED",
  "AI_PROVIDER_ERROR",
  "DB_ERROR",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ToolMetadata {
  tool: string;
  timestamp: string;
  request_id: string;
}

export interface ToolResponse<T = unknown> {
  success: boolean;
  data: T | null;
  error: ToolError | null;
  metadata: ToolMetadata;
}

let counter = 0;

export function makeRequestId(): string {
  counter += 1;
  const rand = Math.random().toString(36).slice(2, 10);
  return `req_${Date.now().toString(36)}_${counter}_${rand}`;
}

export function ok<T>(tool: string, data: T): ToolResponse<T> {
  return {
    success: true,
    data,
    error: null,
    metadata: { tool, timestamp: new Date().toISOString(), request_id: makeRequestId() },
  };
}

export function fail(
  tool: string,
  code: ErrorCode,
  message: string,
  suggestions?: string[]
): ToolResponse<never> {
  return {
    success: false,
    data: null,
    error: { code, message, ...(suggestions ? { suggestions } : {}) },
    metadata: { tool, timestamp: new Date().toISOString(), request_id: makeRequestId() },
  };
}
