# Sentiment Event Project

This repository contains the Python backend responsible for collecting tweets and running sentiment analysis, plus a modern Next.js frontend that surfaces the insights. The backend stores scraped tweets in a local SQLite database and applies transformer-based models to score overall sentiment along with granular emotional signals (fear, desire, greed, etc.), while the frontend presents project context and a policy analysis workspace.

```
sentiment-event/
├── backend/
│   ├── app/
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── models.py
│   │   ├── pipeline.py
│   │   ├── scraper.py
│   │   └── sentiment.py
│   ├── data/
│   ├── main.py
│   ├── README.md
│   └── requirements.txt
└── frontend/
	├── app/
	├── components/
	├── types/
	├── package.json
	└── README.md
```

## Run Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export TWITTER_BEARER_TOKEN="AAAAAAAA..."
python main.py run "cal hacks"
```

On Windows PowerShell use:

```powershell
$env:TWITTER_BEARER_TOKEN = "AAAAAAAA..."
python main.py run "cal hacks"
```

## Run Frontend

```bash
cd frontend
npm install
npm run dev
```
