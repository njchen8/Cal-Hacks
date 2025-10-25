# Sentiment Analysis Backend

## Features

- Scrapes recent tweets for a keyword using `snscrape`
- Stores raw tweet metadata in a local SQLite database via SQLAlchemy
- Runs transformer-based sentiment and emotion analysis
- Exposes a CLI for scraping, analyzing, or running both steps end-to-end

## Getting Started

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r backend/requirements.txt
python backend/main.py run "cal hacks"
```

### Environment Variables

| Name | Description | Default |
| ---- | ----------- | ------- |
| `DATABASE_URL` | SQLAlchemy connection string | `sqlite:///backend/data/tweets.db` |
| `SCRAPE_KEYWORD` | Default keyword for scraping | `cal hacks` |
| `SCRAPE_LIMIT` | Default number of tweets to fetch | `100` |
| `MIN_PROBABILITY` | Threshold for secondary signal reporting | `0.05` |

### CLI Usage

- `python backend/main.py scrape "openai" --limit 50`
- `python backend/main.py analyze --limit 20 --json`
- `python backend/main.py run "cal hacks"`

Sentiment outputs include positive/negative/neutral probabilities and a set of secondary emotion signals (fear, desire, greed, etc.) bucketed into positive, negative, or neutral impact groups.
