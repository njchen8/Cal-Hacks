"use client";

export default function DocsPage() {
  return (
    <div className="page">
      <section className="analysis-panel">
        <header>
          <h1 className="section-heading fade-up">Documentation</h1>
          <p className="section-subtitle fade-up delay-1">
            Setup and usage instructions for the sentiment analysis backend
          </p>
        </header>

        <div className="instructions fade-up delay-2">
          <h2 className="section-heading" style={{ fontSize: "1.5rem", marginTop: "2rem" }}>
            Getting Started
          </h2>

          <h3 style={{ fontSize: "1.2rem", marginTop: "1.5rem", marginBottom: "0.5rem" }}>
            1. Start the Backend Server
          </h3>
          <p>
            Navigate to the backend directory and start the FastAPI server:
          </p>
          <pre style={{
            background: "rgba(255, 255, 255, 0.08)",
            padding: "1rem",
            borderRadius: "8px",
            overflow: "auto"
          }}>
            <code>cd backend{"\n"}uvicorn app.api:app --host 0.0.0.0 --port 8000 --reload</code>
          </pre>

          <h3 style={{ fontSize: "1.2rem", marginTop: "1.5rem", marginBottom: "0.5rem" }}>
            2. Scrape Data from Social Media
          </h3>
          <p>
            Run these commands from the <code>backend</code> directory to collect data:
          </p>

          <h4 style={{ fontSize: "1.1rem", marginTop: "1rem", marginBottom: "0.5rem" }}>
            Twitter (X)
          </h4>
          <pre style={{
            background: "rgba(255, 255, 255, 0.08)",
            padding: "1rem",
            borderRadius: "8px",
            overflow: "auto"
          }}>
            <code>python main.py run "your keyword"</code>
          </pre>

          <h4 style={{ fontSize: "1.1rem", marginTop: "1rem", marginBottom: "0.5rem" }}>
            Reddit
          </h4>
          <pre style={{
            background: "rgba(255, 255, 255, 0.08)",
            padding: "1rem",
            borderRadius: "8px",
            overflow: "auto"
          }}>
            <code>python main.py run-reddit "your keyword"</code>
          </pre>

          <h4 style={{ fontSize: "1.1rem", marginTop: "1rem", marginBottom: "0.5rem" }}>
            Facebook
          </h4>
          <pre style={{
            background: "rgba(255, 255, 255, 0.08)",
            padding: "1rem",
            borderRadius: "8px",
            overflow: "auto"
          }}>
            <code>python main.py run-facebook "your keyword" --page-id PAGE_ID</code>
          </pre>

          <h3 style={{ fontSize: "1.2rem", marginTop: "1.5rem", marginBottom: "0.5rem" }}>
            3. Optional: Fast Analysis Mode
          </h3>
          <p>
            Add <code>--engine fast</code> to any command for lightweight sentiment analysis:
          </p>
          <pre style={{
            background: "rgba(255, 255, 255, 0.08)",
            padding: "1rem",
            borderRadius: "8px",
            overflow: "auto"
          }}>
            <code>python main.py run "your keyword" --engine fast</code>
          </pre>

          <h2 className="section-heading" style={{ fontSize: "1.5rem", marginTop: "2.5rem" }}>
            Configuration
          </h2>

          <h3 style={{ fontSize: "1.2rem", marginTop: "1.5rem", marginBottom: "0.5rem" }}>
            Environment Variables
          </h3>
          <p>
            Create a <code>.env</code> file in the project root with these credentials:
          </p>
          <ul style={{ marginLeft: "1.5rem", lineHeight: "1.8" }}>
            <li><strong>Twitter:</strong> Cookie header from authenticated session</li>
            <li><strong>Reddit:</strong> Client ID and secret from reddit.com/prefs/apps</li>
            <li><strong>Facebook:</strong> App ID, secret, and access token from developers.facebook.com</li>
            <li><strong>Gemini:</strong> API key from makersuite.google.com/app/apikey</li>
          </ul>

          <h2 className="section-heading" style={{ fontSize: "1.5rem", marginTop: "2.5rem" }}>
            Using the Web Interface
          </h2>
          <p>
            Once the backend is running, use the <a href="/analyze" style={{ color: "var(--color-primary)", textDecoration: "underline" }}>Analyze</a> page to:
          </p>
          <ol style={{ marginLeft: "1.5rem", lineHeight: "1.8" }}>
            <li>Enter a product name or keyword</li>
            <li>Choose between full or fast sentiment analysis</li>
            <li>View AI-generated sentiment summaries</li>
            <li>Review detailed sentiment metrics and stored content</li>
          </ol>
        </div>
      </section>
    </div>
  );
}
