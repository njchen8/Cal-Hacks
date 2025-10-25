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

Copy `.env.example` to `.env` and set `TWITTER_BEARER_TOKEN=...` with your X API bearer token, then:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
<<<<<<< HEAD
python main.py run "cal hacks"
```

On Windows Command Prompt (`cmd.exe`):

```cmd
set TWITTER_BEARER_TOKEN=AAAAAAAA...
python main.py run "cal hacks"
=======
python main.py run "your search term"
>>>>>>> 349d0eea3e6a805be7ef4df292b9ad8ea4c824a2
```

On Windows PowerShell:

```powershell
cd backend
python -m venv .venv
\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python main.py run "your search term"
```

## Run Frontend

```bash
cd frontend
npm install
npm run dev
```
<<<<<<< HEAD

The frontend relies on custom CSS transitions and keyframes to deliver lightweight hover and entrance animations that match the Bluberri palette. Update `frontend/app/globals.css` if you want to adjust the blueberry blue / pastel purple / white theme or tweak animation timings.
=======
Configuration values can be stored in a `.env` file (see `.env.example`); the backend loads this automatically at startup.
>>>>>>> 349d0eea3e6a805be7ef4df292b9ad8ea4c824a2
