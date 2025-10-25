import { NextRequest, NextResponse } from "next/server";

const DEFAULT_BACKEND_URL = "http://localhost:8000";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const keyword = typeof body?.keyword === "string" ? body.keyword.trim() : "";
    const limit =
      typeof body?.limit === "number" && Number.isFinite(body.limit) ? Math.max(1, Math.floor(body.limit)) : undefined;
    const refresh = body?.refresh !== undefined ? Boolean(body.refresh) : true;

    if (!keyword) {
      return NextResponse.json({ error: "The 'keyword' field is required." }, { status: 400 });
    }

    const backendUrl = process.env.BACKEND_API_URL ?? DEFAULT_BACKEND_URL;
    const target = `${backendUrl.replace(/\/$/, "")}/analyze`;

    const response = await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword, limit, refresh }),
      cache: "no-store",
    });

    if (!response.ok) {
      const message = await safeReadError(response);
      return NextResponse.json({ error: message }, { status: response.status });
    }

    const payload = await response.json();
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function safeReadError(response: Response): Promise<string> {
  try {
    const data = await response.json();
    if (typeof data?.error === "string") {
      return data.error;
    }
    if (typeof data?.detail === "string") {
      return data.detail;
    }
    return `Backend request failed with status ${response.status}`;
  } catch (err) {
    return `Backend request failed with status ${response.status}`;
  }
}
