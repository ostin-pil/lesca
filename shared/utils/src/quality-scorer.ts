/**
 * Quality Scorer Utility
 *
 * Implements the Wilson Score Interval algorithm to calculate a quality score
 * based on likes and dislikes. This provides a more robust ranking than simple
 * average rating or net likes, especially for items with few votes.
 */

/**
 * Calculate the Wilson Score Interval lower bound
 * @param likes Number of upvotes/likes
 * @param dislikes Number of downvotes/dislikes
 * @param confidence Confidence level (default 0.95 for 95% confidence)
 * @returns Score between 0 and 100
 */
export function calculateWilsonScore(
  likes: number,
  dislikes: number,
  confidence: number = 0.95
): number {
  const n = likes + dislikes

  if (n === 0) return 0

  // z-score for confidence level
  // 0.95 confidence => z = 1.96
  // 0.99 confidence => z = 2.58
  const z = confidence === 0.99 ? 2.58 : 1.96

  const p = likes / n
  const z2 = z * z

  // Wilson Score Formula
  // (p + z²/2n ± z * sqrt((p(1-p) + z²/4n)/n)) / (1 + z²/n)
  // We use the lower bound (-) for conservative ranking

  const left = p + z2 / (2 * n)
  const right = z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n)
  const under = 1 + z2 / n

  const score = (left - right) / under

  // Normalize to 0-100 scale and round to 2 decimal places
  return Math.round(score * 10000) / 100
}

/**
 * Calculate quality score for a problem
 * @param likes Number of likes
 * @param dislikes Number of dislikes
 * @returns Quality score (0-100)
 */
export function calculateQuality(likes: number, dislikes: number): number {
  return calculateWilsonScore(likes, dislikes)
}
