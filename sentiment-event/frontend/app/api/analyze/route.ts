import { NextRequest, NextResponse } from "next/server";

const DEFAULT_BACKEND_URL = "http://localhost:8000";

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ error: "The 'text' field is required." }, { status: 400 });
    }

    const backendUrl = process.env.BACKEND_API_URL ?? DEFAULT_BACKEND_URL;
    const target = `${backendUrl.replace(/\/$/, "")}/analyze`;

    const response = await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
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
