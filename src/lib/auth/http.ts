import "server-only";

export function requestOrigin(request: Request): string | null {
  const host = request.headers.get("host");
  if (!host) return null;
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  return `${proto.split(",")[0].trim()}://${host}`;
}

export function hostOf(value: string): string | null {
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}


export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const expected = requestOrigin(request);
  const actual = hostOf(origin);
  return expected !== null && actual !== null && hostOf(expected) === actual;
}

export function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}
