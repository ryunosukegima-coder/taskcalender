import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ValidationError, type ValidationErrorCode } from "../../shared/validation.js";

export type ErrorCode =
  | ValidationErrorCode
  | "NOT_FOUND"
  | "DUPLICATE_TITLE"
  | "INVALID_BODY"
  | "METHOD_NOT_ALLOWED"
  | "INTERNAL_ERROR"
  | "UNAUTHORIZED"
  | "INVALID_CREDENTIALS"
  | "EMAIL_TAKEN";

export class ApiError extends Error {
  code: ErrorCode;
  status: number;
  extra?: Record<string, unknown>;
  constructor(status: number, code: ErrorCode, message: string, extra?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.status = status;
    this.extra = extra;
  }
}

export function sendError(res: VercelResponse, err: unknown): void {
  if (err instanceof ValidationError) {
    const status = err.code === "MALICIOUS_INPUT" ? 422 : 400;
    res.status(status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  if (err instanceof ApiError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, ...err.extra },
    });
    return;
  }
  console.error(err);
  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "処理できませんでした" },
  });
}

export function methodNotAllowed(res: VercelResponse, allowed: string[]): void {
  res.setHeader("Allow", allowed.join(", "));
  res.status(405).json({
    error: { code: "METHOD_NOT_ALLOWED", message: "許可されていないメソッドです" },
  });
}

export function readJsonBody<T = Record<string, unknown>>(req: VercelRequest): T {
  const body = req.body;
  if (body == null) return {} as T;
  if (typeof body === "string") {
    try {
      return JSON.parse(body) as T;
    } catch {
      throw new ApiError(400, "INVALID_BODY", "リクエストの形式が正しくありません");
    }
  }
  return body as T;
}
