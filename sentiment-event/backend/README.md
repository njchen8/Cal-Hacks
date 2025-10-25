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
# Set TWITTER_BEARER_TOKEN directly or edit ..\..\.env
$env:TWITTER_BEARER_TOKEN = "YOUR_BEARER_TOKEN"
```

## Twitter Authentication

The scraper now calls the official X (Twitter) v2 Search Recent endpoint and requires an app bearer token. Create an app in the [X Developer Portal](https://developer.twitter.com/en/portal/dashboard), enable Elevated access, and grab the **App-only OAuth2 Bearer Token**.

Set the token in your shell (or copy `.env.example` to `.env`) before running commands:

```powershell
$env:TWITTER_BEARER_TOKEN = "AAAAAAAA..."
```

Optionally customise the reported user agent:

```powershell
$env:TWITTER_APP_USER_AGENT = "MySentimentBot/0.1"
```

Treat these credentials as secrets—do not check them into source control.

If you maintain a `.env` file, set `TWITTER_BEARER_TOKEN=` (and optionally `TWITTER_APP_USER_AGENT=`) within it instead of exporting variables every session; the backend automatically reads `.env` files at startup.

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
