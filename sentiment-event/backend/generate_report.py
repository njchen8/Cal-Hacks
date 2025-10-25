"""Generate a presentable sentiment analysis report from analyzed posts."""

from datetime import datetime
from app.database import get_session
from app.models import Tweet
from sqlalchemy import select

def generate_report(output_file="sentiment_report.txt"):
    """Generate a formatted text report of sentiment analysis results."""

    with get_session() as session:
        # Get all analyzed posts
        stmt = select(Tweet).where(Tweet.sentiment.is_not(None)).order_by(Tweet.created_at.desc())
        posts = session.scalars(stmt).all()

        if not posts:
            print("No analyzed posts found. Run analysis first.")
            return

        # Generate report
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write("=" * 80 + "\n")
            f.write("SENTIMENT ANALYSIS REPORT\n")
            f.write("=" * 80 + "\n")
            f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"Total Posts Analyzed: {len(posts)}\n")
            f.write("=" * 80 + "\n\n")

            # Calculate overall sentiment distribution
            positive_count = sum(1 for p in posts if p.sentiment['primary']['label'] == 'positive')
            negative_count = sum(1 for p in posts if p.sentiment['primary']['label'] == 'negative')
            neutral_count = sum(1 for p in posts if p.sentiment['primary']['label'] == 'neutral')

            f.write("OVERALL SENTIMENT DISTRIBUTION:\n")
            f.write("-" * 80 + "\n")
            f.write(f"Positive: {positive_count} ({positive_count/len(posts)*100:.1f}%)\n")
            f.write(f"Negative: {negative_count} ({negative_count/len(posts)*100:.1f}%)\n")
            f.write(f"Neutral:  {neutral_count} ({neutral_count/len(posts)*100:.1f}%)\n")
            f.write("\n")

            # Individual post analysis
            f.write("INDIVIDUAL POST ANALYSIS:\n")
            f.write("=" * 80 + "\n\n")

            for i, post in enumerate(posts, 1):
                sentiment = post.sentiment
                primary = sentiment['primary']
                signals = sentiment['signals']

                f.write(f"POST #{i}\n")
                f.write("-" * 80 + "\n")
                f.write(f"Source:   {post.tweet_id.split('_')[0].upper()}\n")
                f.write(f"Author:   u/{post.username}\n")
                f.write(f"Date:     {post.created_at.strftime('%Y-%m-%d %H:%M')}\n")
                f.write(f"URL:      {post.url}\n")
                f.write(f"Score:    {post.like_count} upvotes\n")
                f.write("\n")

                # Content preview
                content_preview = post.content[:200].replace('\n', ' ')
                if len(post.content) > 200:
                    content_preview += "..."
                f.write(f"Content:  {content_preview}\n")
                f.write("\n")

                # Sentiment scores
                f.write("SENTIMENT ANALYSIS:\n")
                f.write(f"  Primary Label:  {primary['label'].upper()}\n")
                f.write(f"  Confidence:     {primary['confidence']:.1%}\n")
                f.write(f"  Positive Score: {primary['positive']:.1%}\n")
                f.write(f"  Negative Score: {primary['negative']:.1%}\n")
                f.write(f"  Neutral Score:  {primary['neutral']:.1%}\n")
                f.write("\n")

                # Emotion signals
                f.write("EMOTION SIGNALS:\n")
                for category in ['positive', 'negative', 'neutral']:
                    emotions = signals.get(category, {})
                    if emotions:
                        f.write(f"  {category.capitalize()}: ")
                        emotion_strs = [f"{emotion}({score:.1%})" for emotion, score in emotions.items()]
                        f.write(", ".join(emotion_strs))
                        f.write("\n")

                f.write("\n" + "=" * 80 + "\n\n")

        print(f"Report generated: {output_file}")
        print(f"Total posts analyzed: {len(posts)}")

if __name__ == "__main__":
    generate_report()
