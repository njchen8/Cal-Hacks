# Sentiment Analysis Backend

CLI utilities for scraping tweets into a local SQLite database and running transformer-based sentiment and emotion scoring.

## Setup

```powershell
cd Cal-Hacks\sentiment-event\backend
python -m venv .venv
\.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
# Optional: duplicate the template env file for local secrets
Copy-Item ..\..\.env.example ..\.env -ErrorAction SilentlyContinue
# Provide credentials once so Twikit can create cookies
$env:TWITTER_USERNAME = "your_username_or_email"
$env:TWITTER_PASSWORD = "your_password"
```

## Twitter Authentication

The scraper now uses [Twikit](https://github.com/d60/twikit) to perform authenticated searches. On the first run you must supply `TWITTER_USERNAME` and `TWITTER_PASSWORD` (username/email + password) so Twikit can log in and save session cookies to `backend/data/twitter_cookies.json`. Subsequent runs reuse the saved cookies, so you can remove the credentials from your environment after the initial login.

If you already have a cookie file or header string, you can set `TWITTER_COOKIE_FILE` or `TWITTER_COOKIE_HEADER` instead of providing credentials.

Optional customise the reported user agent:

```powershell
$env:TWITTER_USER_AGENT = "Mozilla/5.0 ..."
```

Treat these credentials as secrets—do not check them into source control. The backend automatically reads `.env` files at startup.

## Usage

Initialize the database and run scrape + analysis in a single step:

```powershell
python main.py run "your search term"
```

Other commands:

```powershell
python main.py scrape "another keyword" --limit 50
python main.py analyze --limit 100 --json
```

Analyzed tweets are stored in `data/tweets.db` with per-tweet primary sentiment scores and bucketed secondary emotion signals.

## API Server

Launch the FastAPI server to expose an HTTP endpoint that mirrors the CLI workflow:

```powershell
uvicorn app.api:app --host 0.0.0.0 --port 8000
```

Endpoint summary:

- `POST /analyze` — body `{ "keyword": "iphone", "limit": 100?, "refresh": true }`
	- Scrapes and analyzes tweets when `refresh` is true (default) then returns aggregated primary sentiment and supporting signals.
- `GET /healthz` — simple readiness probe.

The response includes `primary`/`signals` payloads plus metadata describing how many tweets were scraped, analyzed, and included in the aggregate.
