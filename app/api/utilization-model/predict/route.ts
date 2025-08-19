/**
 * Utilization Prediction API Route
 *
 * Bridges the Next.js app to the Python FastAPI utilization service. Accepts a
 * JSON body of optional numeric features and forwards them to the upstream
 * `/predict` endpoint. Validates the upstream response to ensure it includes
 * all expected utilization count fields before returning to the client.
 *
 * Key behavior:
 * - Reads `PY_UTILIZATION_BASE_URL` env var (defaults to http://127.0.0.1:8001)
 * - 15s timeout with abort controller
 * - Returns 502 if upstream fails or response shape is invalid
 * - Returns 504 on client-aborted timeout, otherwise 500 on unknown errors
 */
import { NextResponse } from "next/server";

// Minimal schema validation without bringing in zod here
type PredictRequest = Record<string, unknown>;

interface PredictResponse {
  pcp_visits: number;
  outpatient_visits: number;
  er_visits: number;
  inpatient_admits: number;
  home_health_visits: number;
  rx_fills: number;
  dental_visits: number;
  equipment_purchases: number;
}

// Avoid direct Node `process` typing to satisfy edge runtimes and linting
function getPythonBaseUrl(): string {
  const env = (globalThis as any)?.process?.env as
    | Record<string, string | undefined>
    | undefined;
  return env?.PY_UTILIZATION_BASE_URL || "http://127.0.0.1:8001";
}

function isValidResponse(json: any): json is PredictResponse {
  if (!json || typeof json !== "object") return false;
  const keys = [
    "pcp_visits",
    "outpatient_visits",
    "er_visits",
    "inpatient_admits",
    "home_health_visits",
    "rx_fills",
    "dental_visits",
    "equipment_purchases",
  ] as const;
  return keys.every(
    (k) => typeof json[k] === "number" && Number.isFinite(json[k])
  );
}

export async function POST(req: Request): Promise<Response> {
  const baseUrl = getPythonBaseUrl();
  let body: PredictRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { status: "error", detail: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`${baseUrl}/predict`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    clearTimeout(timeout);

    const text = await res.text().catch(() => "");
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    if (!res.ok || !isValidResponse(json)) {
      return NextResponse.json(
        {
          status: "error",
          code: res.status,
          detail: "Upstream prediction failed or returned invalid response",
          upstream: text?.slice(0, 500),
        },
        { status: 502 }
      );
    }

    return NextResponse.json(json as PredictResponse, { status: 200 });
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
