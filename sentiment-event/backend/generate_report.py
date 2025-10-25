"""Generate a CSV sentiment analysis report from analyzed posts for database import."""

import csv
import json
from datetime import datetime
from app.database import get_session
from app.models import Tweet
from sqlalchemy import select

def generate_report(output_file="sentiment_report.csv"):
    """Generate a CSV report of sentiment analysis results.

    CSV columns:
    - post_id: Unique identifier
    - source: Platform (REDDIT, TWITTER)
    - author: Username
    - created_at: Post timestamp
    - url: Post URL
    - upvotes: Like/upvote count
    - content: Post text (truncated to 500 chars)
    - sentiment_label: Primary sentiment (POSITIVE, NEGATIVE, NEUTRAL)
    - sentiment_confidence: Confidence score (0-1)
    - positive_score: Positive probability (0-1)
    - negative_score: Negative probability (0-1)
    - neutral_score: Neutral probability (0-1)
    - emotions_positive: JSON of positive emotions
    - emotions_negative: JSON of negative emotions
    - emotions_neutral: JSON of neutral emotions
    """

    with get_session() as session:
        # Get all analyzed posts
        stmt = select(Tweet).where(Tweet.sentiment.is_not(None)).order_by(Tweet.created_at.desc())
        posts = session.scalars(stmt).all()

        if not posts:
            print("No analyzed posts found. Run analysis first.")
            return

        # Generate CSV report
        with open(output_file, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)

            # Write header
            writer.writerow([
                'post_id',
                'source',
                'author',
                'created_at',
                'url',
                'upvotes',
                'content',
                'sentiment_label',
                'sentiment_confidence',
                'positive_score',
                'negative_score',
                'neutral_score',
                'emotions_positive',
                'emotions_negative',
                'emotions_neutral'
            ])

            # Write data rows
            for post in posts:
                sentiment = post.sentiment
                primary = sentiment['primary']
                signals = sentiment['signals']

                # Truncate content for CSV
                content = post.content[:500].replace('\n', ' ').replace('\r', '')
                if len(post.content) > 500:
                    content += "..."

                # Extract source from post_id
                source = post.tweet_id.split('_')[0].upper()

                writer.writerow([
                    post.tweet_id,
                    source,
                    post.username,
                    post.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                    post.url,
                    post.like_count,
                    content,
                    primary['label'].upper(),
                    round(primary['confidence'], 4),
                    round(primary['positive'], 4),
                    round(primary['negative'], 4),
                    round(primary['neutral'], 4),
                    json.dumps(signals.get('positive', {})),
                    json.dumps(signals.get('negative', {})),
                    json.dumps(signals.get('neutral', {}))
                ])

        # Calculate summary stats
        positive_count = sum(1 for p in posts if p.sentiment['primary']['label'] == 'positive')
        negative_count = sum(1 for p in posts if p.sentiment['primary']['label'] == 'negative')
        neutral_count = sum(1 for p in posts if p.sentiment['primary']['label'] == 'neutral')

        print(f"CSV report generated: {output_file}")
        print(f"Total posts analyzed: {len(posts)}")
        print(f"Sentiment distribution:")
        print(f"  Positive: {positive_count} ({positive_count/len(posts)*100:.1f}%)")
        print(f"  Negative: {negative_count} ({negative_count/len(posts)*100:.1f}%)")
        print(f"  Neutral:  {neutral_count} ({neutral_count/len(posts)*100:.1f}%)")

if __name__ == "__main__":
    generate_report()
