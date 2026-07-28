import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { DomainError } from "@/shared/errors/domain-error";

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data, requestId: crypto.randomUUID() }, { status });
}

export function apiError(error: unknown) {
  const requestId = crypto.randomUUID();
  if (error instanceof ZodError) {
    return NextResponse.json({ ok: false, error: { code: "VALIDATION_FAILED", message: "请求参数无效", fields: error.flatten().fieldErrors }, requestId }, { status: 422 });
  }
  if (error instanceof DomainError) {
    return NextResponse.json({ ok: false, error: { code: error.code, message: error.message }, requestId }, { status: error.status });
  }
  console.error(JSON.stringify({ level: "error", event: "api_error", requestId }));
  return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: "服务暂时不可用" }, requestId }, { status: 500 });
}
