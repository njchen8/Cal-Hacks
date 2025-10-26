"""Generate human-friendly sentiment summaries using Lava Gateway API."""

from __future__ import annotations

import csv
import json
import os
from pathlib import Path
from typing import Dict, List, Any
import requests

from app.config import settings


class LavaGatewaySummarizer:
    """Analyzes sentiment CSV data and generates professional text summaries using Lava Gateway."""

    def __init__(self, api_key: str | None = None, base_url: str | None = None,
                 connection_secret: str | None = None, product_secret: str | None = None):
        """Initialize the Lava Gateway summarizer.

        Args:
            api_key: Lava Gateway API key (defaults to LAVA_API_KEY env var)
            base_url: Lava Gateway API base URL (defaults to LAVA_BASE_URL env var)
            connection_secret: Lava Gateway connection secret (defaults to LAVA_CONNECTION_SECRET env var)
            product_secret: Lava Gateway product secret (defaults to LAVA_PRODUCT_SECRET env var)
        """
        self.api_key = api_key or os.getenv("LAVA_API_KEY")
        self.connection_secret = connection_secret or os.getenv("LAVA_CONNECTION_SECRET")
        self.product_secret = product_secret or os.getenv("LAVA_PRODUCT_SECRET")
        self.base_url = base_url or os.getenv("LAVA_BASE_URL", "https://api.lavapayments.com/v1/forward?u=https://api.openai.com/v1")

        if not self.api_key:
            raise ValueError("LAVA_API_KEY must be set in environment or passed to constructor")
        if not self.connection_secret:
            raise ValueError("LAVA_CONNECTION_SECRET must be set in environment or passed to constructor")
        if not self.product_secret:
            raise ValueError("LAVA_PRODUCT_SECRET must be set in environment or passed to constructor")

    def read_csv(self, csv_path: str | Path) -> List[Dict[str, Any]]:
        """Read sentiment CSV file and return parsed data.

        Args:
            csv_path: Path to the sentiment CSV file

        Returns:
            List of dictionaries containing parsed CSV data
        """
        csv_path = Path(csv_path)
        if not csv_path.exists():
            raise FileNotFoundError(f"CSV file not found: {csv_path}")

        posts = []
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Parse emotion JSON strings
                try:
                    row['emotions_positive'] = json.loads(row['emotions_positive'])
                except (json.JSONDecodeError, KeyError):
                    row['emotions_positive'] = {}

                try:
                    row['emotions_negative'] = json.loads(row['emotions_negative'])
                except (json.JSONDecodeError, KeyError):
                    row['emotions_negative'] = {}

                try:
                    row['emotions_neutral'] = json.loads(row['emotions_neutral'])
                except (json.JSONDecodeError, KeyError):
                    row['emotions_neutral'] = {}

                posts.append(row)

        return posts

    def analyze_sentiment_distribution(self, posts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze the overall sentiment distribution and patterns.

        Args:
            posts: List of parsed post dictionaries

        Returns:
            Dictionary with sentiment statistics
        """
        total = len(posts)
        if total == 0:
            return {
                'total_posts': 0,
                'sentiment_counts': {},
                'sentiment_percentages': {},
                'avg_scores': {},
                'top_emotions': {},
                'sample_posts': {}
            }

        # Count sentiments
        sentiment_counts = {'POSITIVE': 0, 'NEGATIVE': 0, 'NEUTRAL': 0}
        sentiment_scores = {'positive': [], 'negative': [], 'neutral': []}
        all_emotions_positive = {}
        all_emotions_negative = {}
        sample_posts = {'POSITIVE': [], 'NEGATIVE': [], 'NEUTRAL': []}

        for post in posts:
            label = post.get('sentiment_label', 'NEUTRAL').upper()
            sentiment_counts[label] = sentiment_counts.get(label, 0) + 1

            # Collect scores
            try:
                sentiment_scores['positive'].append(float(post.get('positive_score', 0)))
                sentiment_scores['negative'].append(float(post.get('negative_score', 0)))
                sentiment_scores['neutral'].append(float(post.get('neutral_score', 0)))
            except (ValueError, TypeError):
                pass

            # Aggregate emotions
            for emotion, score in post.get('emotions_positive', {}).items():
                all_emotions_positive[emotion] = all_emotions_positive.get(emotion, []) + [score]

            for emotion, score in post.get('emotions_negative', {}).items():
                all_emotions_negative[emotion] = all_emotions_negative.get(emotion, []) + [score]

            # Collect sample posts (up to 3 per sentiment)
            if len(sample_posts[label]) < 3:
                sample_posts[label].append({
                    'content': post.get('content', '')[:200] + '...' if len(post.get('content', '')) > 200 else post.get('content', ''),
                    'author': post.get('author', 'Unknown'),
                    'upvotes': post.get('upvotes', 0),
                    'confidence': post.get('sentiment_confidence', 0)
                })

        # Calculate percentages and averages
        sentiment_percentages = {k: (v / total) * 100 for k, v in sentiment_counts.items()}
        avg_scores = {k: sum(v) / len(v) if v else 0 for k, v in sentiment_scores.items()}

        # Get top emotions
        top_emotions_positive = {
            emotion: sum(scores) / len(scores)
            for emotion, scores in all_emotions_positive.items()
        }
        top_emotions_positive = dict(sorted(top_emotions_positive.items(), key=lambda x: x[1], reverse=True)[:5])

        top_emotions_negative = {
            emotion: sum(scores) / len(scores)
            for emotion, scores in all_emotions_negative.items()
        }
        top_emotions_negative = dict(sorted(top_emotions_negative.items(), key=lambda x: x[1], reverse=True)[:5])

        return {
            'total_posts': total,
            'sentiment_counts': sentiment_counts,
            'sentiment_percentages': sentiment_percentages,
            'avg_scores': avg_scores,
            'top_emotions_positive': top_emotions_positive,
            'top_emotions_negative': top_emotions_negative,
            'sample_posts': sample_posts,
            'keyword': posts[0].get('keyword', 'Unknown') if posts else 'Unknown',
            'source': posts[0].get('source', 'Unknown') if posts else 'Unknown'
        }

    def build_analysis_prompt(self, stats: Dict[str, Any], posts: List[Dict[str, Any]]) -> str:
        """Build a comprehensive prompt for Lava Gateway to analyze.

        Args:
            stats: Sentiment statistics dictionary
            posts: List of all posts

        Returns:
            Formatted prompt string
        """
        # Sample representative posts for each sentiment
        positive_samples = [p['content'][:300] for p in posts if p.get('sentiment_label') == 'POSITIVE'][:5]
        negative_samples = [p['content'][:300] for p in posts if p.get('sentiment_label') == 'NEGATIVE'][:5]
        neutral_samples = [p['content'][:300] for p in posts if p.get('sentiment_label') == 'NEUTRAL'][:5]

        total_posts = max(stats['total_posts'], 1)

        def share_label(count: int) -> str:
            if count <= 0:
                return "minimal"
            ratio = count / total_posts
            if ratio >= 0.6:
                return "most"
            if ratio >= 0.35:
                return "many"
            if ratio >= 0.15:
                return "some"
            return "a handful"

        sentiment_mix = {
            "positive": share_label(stats['sentiment_counts'].get('POSITIVE', 0)),
            "negative": share_label(stats['sentiment_counts'].get('NEGATIVE', 0)),
            "neutral": share_label(stats['sentiment_counts'].get('NEUTRAL', 0)),
        }

        positive_emotions = list(stats['top_emotions_positive'].keys())[:3]
        negative_emotions = list(stats['top_emotions_negative'].keys())[:3]

        def size_label(total: int) -> str:
            if total <= 0:
                return "no content available"
            if total < 20:
                return "a small sample"
            if total < 60:
                return "a modest sample"
            if total < 150:
                return "a large sample"
            return "a very large sample"

        prompt = f"""You are a qualitative insights author. Study the dataset below and craft a narrative report.

Dataset snapshot:
- Topic: {stats['keyword']}
- Source: {stats['source']}
- Sample size: {size_label(stats['total_posts'])}

Qualitative sentiment mix:
- Positive reactions: {sentiment_mix['positive']}
- Negative reactions: {sentiment_mix['negative']}
- Neutral reactions: {sentiment_mix['neutral']}

Emotion cues:
- Dominant positive emotions: {', '.join(positive_emotions) if positive_emotions else 'none surfaced'}
- Dominant negative emotions: {', '.join(negative_emotions) if negative_emotions else 'none surfaced'}

Sample positive reactions:
{chr(10).join(f'- {post}' for post in positive_samples) if positive_samples else '- (no clear positive examples appeared)'}

Sample negative reactions:
{chr(10).join(f'- {post}' for post in negative_samples) if negative_samples else '- (no clear negative examples appeared)'}

Sample neutral reactions:
{chr(10).join(f'- {post}' for post in neutral_samples) if neutral_samples else '- (no clearly neutral examples appeared)'}

Write a concise Markdown report (under 350 words) using these sections:

### Sentiment Overview
Describe the prevailing mood without quoting exact counts, scores, or percentages. Use qualitative phrases like "most", "many", "a few".

### Emotional Signals
Explain the emotional undertones. Mention only the dominant emotions listed above and describe how they appear in the posts.

### What People Are Saying
Summarize major conversation threads. Reference specific pain points or delights using natural language paraphrases instead of metrics.

### Bright Spots
Call out positive observations, even if scarce. Focus on tone and context rather than numbers.

### Pain Points
Lay out the biggest friction areas. Be direct and empathetic; avoid percentages or exact counts.

### Actions To Consider
Provide three bullet points with pragmatic, plain-language recommendations. Each bullet should be one sentence, action-oriented, and qualitative.

Writing guidelines:
- No numerical values, percentages, or raw scores anywhere in the output.
- Maintain a professional, human tone (no marketing fluff).
- Use short paragraphs (max 2 sentences) for readability.
- Prioritize clarity and storytelling over analytics jargon.
"""

        return prompt

    def call_lava_gateway(self, prompt: str, model: str = "gpt-4o-mini") -> str:
        """Call Lava Gateway API to generate the summary.

        Args:
            prompt: The analysis prompt
            model: The model to use (default: gpt-4o-mini via OpenAI)

        Returns:
            Generated summary text
        """
        # Lava Gateway uses a combined bearer token with all three secrets (base64 encoded)
        import json as json_lib
        import base64

        auth_data = json_lib.dumps({
            "secret_key": self.api_key,
            "connection_secret": self.connection_secret,
            "product_secret": self.product_secret
        })
        auth_token = base64.b64encode(auth_data.encode()).decode()

        headers = {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": model,
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "max_tokens": 4000,
            "temperature": 0.7,
            "top_p": 0.9
        }

        try:
            # Lava Gateway base URL already includes /chat/completions path
            response = requests.post(
                self.base_url,
                headers=headers,
                json=payload,
                timeout=120
            )
            response.raise_for_status()

            result = response.json()
            return result['choices'][0]['message']['content']

        except requests.exceptions.RequestException as e:
            error_detail = ""
            try:
                error_detail = f"\nResponse body: {response.text}"
            except:
                pass
            raise RuntimeError(f"Lava Gateway API call failed: {e}{error_detail}")

    def generate_summary(
        self,
        csv_path: str | Path,
        output_path: str | Path | None = None,
        model: str = "gpt-4o-mini"
    ) -> str:
        """Generate a complete sentiment summary report.

        Args:
            csv_path: Path to the sentiment CSV file
            output_path: Optional path to save the report (if None, only returns string)
            model: Lava Gateway model to use

        Returns:
            The generated summary text
        """
        # Read and analyze the CSV
        print(f"Reading CSV file: {csv_path}")
        posts = self.read_csv(csv_path)

        print(f"Analyzing {len(posts)} posts...")
        stats = self.analyze_sentiment_distribution(posts)

        # Build prompt
        print("Building analysis prompt...")
        prompt = self.build_analysis_prompt(stats, posts)

        # Call Lava Gateway
        print(f"Calling Lava Gateway API with model: {model}")
        summary = self.call_lava_gateway(prompt, model)

        # Optionally save to file
        if output_path:
            output_path = Path(output_path)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(summary)
            print(f"Summary saved to: {output_path}")

        return summary


def main():
    """CLI entry point for generating sentiment summaries."""
    import argparse

    parser = argparse.ArgumentParser(description="Generate sentiment summaries using Lava Gateway")
    parser.add_argument("csv_file", type=str, help="Path to sentiment CSV file")
    parser.add_argument(
        "--output", "-o",
        type=str,
        help="Output file path (default: reports/summary_<keyword>.txt)"
    )
    parser.add_argument(
        "--model", "-m",
        type=str,
        default="gpt-4o-mini",
        help="OpenAI model to use via Lava Gateway (default: gpt-4o-mini)"
    )
    parser.add_argument(
        "--api-key",
        type=str,
        help="Lava Gateway API key (defaults to LAVA_API_KEY env var)"
    )

    args = parser.parse_args()

    # Determine output path
    if args.output:
        output_path = args.output
    else:
        csv_path = Path(args.csv_file)
        keyword = csv_path.stem.replace('sentiment_', '')
        output_path = settings.base_dir / "reports" / f"summary_{keyword}.txt"

    # Generate summary
    summarizer = LavaGatewaySummarizer(api_key=args.api_key)
    summary = summarizer.generate_summary(args.csv_file, output_path, args.model)

    print("\n" + "="*80)
    print("SENTIMENT ANALYSIS SUMMARY")
    print("="*80)
    print(summary)
    print("="*80)


if __name__ == "__main__":
    main()
