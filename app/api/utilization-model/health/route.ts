import { NextResponse } from "next/server";

// Avoid direct Node `process` typing to satisfy edge runtimes and linting
function getPythonBaseUrl(): string {
  const env = (globalThis as any)?.process?.env as
    | Record<string, string | undefined>
    | undefined;
  return env?.PY_UTILIZATION_BASE_URL || "http://127.0.0.1:8001";
}

export async function GET(): Promise<Response> {
  const baseUrl = getPythonBaseUrl();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${baseUrl}/health`, {
      method: "GET",
      signal: controller.signal,
      headers: {
        accept: "application/json",
      },
      // ensure server-side only
      cache: "no-store",
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        {
          status: "error",
          code: res.status,
          detail: text || "Python service health check failed",
        },
        { status: 502 }
      );
    }

    const data = await res.json().catch(() => ({}));
    return NextResponse.json({ status: "ok", upstream: data }, { status: 200 });
  } catch (error: unknown) {
    clearTimeout(timeout);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("The user aborted a request") ? 504 : 500;
    return NextResponse.json(
      { status: "error", code: status, detail: message },
      { status }
    );
  }
}
