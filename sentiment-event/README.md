# Bluberri

Bluberri pairs a Python backend that collects tweets and runs sentiment analysis with a modern Next.js frontend that surfaces launch-ready insights. The backend stores scraped tweets in a local SQLite database and applies transformer-based models to score overall sentiment along with granular emotional signals (fear, desire, greed, etc.), while the frontend frames those signals inside a blueberry-blue, pastel-purple, and white experience using lightweight CSS-based motion accents.

```
bluberri/
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

Copy `.env.example` to `.env` and provide either your Twitter credentials (`TWITTER_USERNAME` and `TWITTER_PASSWORD`) for the first login or a full cookie header via `TWITTER_COOKIE_HEADER`. Twikit will save authenticated cookies to `backend/data/twitter_cookies.json` for reuse.

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py run "your search term"
uvicorn app.api:app --host 0.0.0.0 --port 8000
```

On Windows PowerShell:

```powershell
cd backend
python -m venv .venv
\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python main.py run "your search term"
uvicorn app.api:app --host 0.0.0.0 --port 8000
```

## Run Frontend

```bash
cd frontend
npm install
npm run dev
```

Set `BACKEND_API_URL` in the frontend environment (or `.env.local`) to the FastAPI URL. The proxy defaults to `http://localhost:8000` for local development.


