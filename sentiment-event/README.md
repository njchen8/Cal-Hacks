# Sentiment Event Project

This repository currently contains the Python backend responsible for collecting tweets and running sentiment analysis. The backend stores scraped tweets in a local SQLite database and applies transformer-based models to score overall sentiment along with granular emotional signals (fear, desire, greed, etc.).

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
└── frontend/  # Reserved for a future client application
```

See `backend/README.md` for setup and usage instructions.
