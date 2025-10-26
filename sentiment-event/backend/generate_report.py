"""Generate keyword-specific CSV sentiment analysis reports from analyzed posts."""

import csv
import json
import re
import sys
from datetime import datetime
from pathlib import Path
from app.database import get_session
from app.models import Tweet
from sqlalchemy import select


def sanitize_filename(keyword: str) -> str:
    """Convert keyword to safe filename."""
    # Remove special characters and replace spaces with underscores
    safe_name = re.sub(r'[^\w\s-]', '', keyword.lower())
    safe_name = re.sub(r'[\s]+', '_', safe_name)
    return safe_name


def generate_report_by_keyword(keyword: str = None, output_dir: str = "reports") -> list[Path]:
    """Generate a CSV report of sentiment analysis results for a specific keyword.

    Args:
        keyword: Filter posts by this keyword. If None, generates separate CSVs for each keyword.
        output_dir: Directory to save CSV files

    CSV columns:
    - post_id: Unique identifier
    - source: Platform (REDDIT, TWITTER)
    - keyword: Search term used
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

    # Create output directory if it doesn't exist
    output_path = Path(output_dir)
    output_path.mkdir(exist_ok=True)

    with get_session() as session:
        # Get all analyzed posts
        stmt = select(Tweet).where(Tweet.sentiment.is_not(None)).order_by(Tweet.created_at.desc())

        if keyword:
            # Filter by specific keyword
            stmt = stmt.where(Tweet.keyword == keyword)

        posts = session.scalars(stmt).all()

        if not posts:
            print(f"No analyzed posts found{f' for keyword: {keyword}' if keyword else ''}. Run analysis first.")
            return []

        # Group posts by keyword
        posts_by_keyword = {}
        for post in posts:
            kw = post.keyword
            if kw not in posts_by_keyword:
                posts_by_keyword[kw] = []
            posts_by_keyword[kw].append(post)

        # Generate CSV for each keyword
        generated_files: list[Path] = []
        for kw, kw_posts in posts_by_keyword.items():
            # Create safe filename
            safe_kw = sanitize_filename(kw)
            output_file = output_path / f"sentiment_{safe_kw}.csv"

            # Generate CSV report
            with open(output_file, 'w', newline='', encoding='utf-8') as f:
                writer = csv.writer(f)

                # Write header
                writer.writerow([
                    'post_id',
                    'source',
                    'keyword',
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
                for post in kw_posts:
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
                        post.keyword,
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
            positive_count = sum(1 for p in kw_posts if p.sentiment['primary']['label'] == 'positive')
            negative_count = sum(1 for p in kw_posts if p.sentiment['primary']['label'] == 'negative')
            neutral_count = sum(1 for p in kw_posts if p.sentiment['primary']['label'] == 'neutral')

            print(f"\n{'='*80}")
            print(f"CSV report generated: {output_file}")
            print(f"Keyword: '{kw}'")
            print(f"Total posts: {len(kw_posts)}")
            print(f"Sentiment distribution:")
            print(f"  Positive: {positive_count} ({positive_count/len(kw_posts)*100:.1f}%)")
            print(f"  Negative: {negative_count} ({negative_count/len(kw_posts)*100:.1f}%)")
            print(f"  Neutral:  {neutral_count} ({neutral_count/len(kw_posts)*100:.1f}%)")
            print(f"{'='*80}")

            generated_files.append(output_file)

        total_files = len(generated_files)
        print(f"\n[OK] Generated {total_files} CSV file(s) in {output_dir}/ directory")
        return generated_files


if __name__ == "__main__":
    # Allow optional keyword argument
    keyword = sys.argv[1] if len(sys.argv) > 1 else None
    generated_files = generate_report_by_keyword(keyword)
    total_files = len(generated_files)
    if total_files == 0:
        sys.exit(1)
    sys.exit(0)
