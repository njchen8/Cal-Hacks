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

    const envBackend = process.env.BACKEND_API_URL?.trim() || DEFAULT_BACKEND_URL;
    let backendUrl = envBackend.replace(/\/$/, "");
    if (backendUrl.startsWith("http://0.0.0.0")) {
      backendUrl = backendUrl.replace("0.0.0.0", "127.0.0.1");
    } else if (backendUrl.startsWith("https://0.0.0.0")) {
      backendUrl = backendUrl.replace("0.0.0.0", "127.0.0.1");
    }

    const target = `${backendUrl}/analyze/stream`;

    const backendResponse = await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword, limit, refresh }),
      cache: "no-store",
    });

    if (!backendResponse.ok || !backendResponse.body) {
      const message = await safeReadError(backendResponse);
      return NextResponse.json({ error: message }, { status: backendResponse.status });
    }

    const stream = new ReadableStream({
      async start(controller) {
        const reader = backendResponse.body!.getReader();
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) {
              break;
            }
            if (value) {
              controller.enqueue(value);
            }
          }
        } finally {
          controller.close();
        }
      },
    });

    const contentType = backendResponse.headers.get("content-type") ?? "application/x-ndjson";
    return new NextResponse(stream, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
      },
    });
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
