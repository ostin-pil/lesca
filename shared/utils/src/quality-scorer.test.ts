import { describe, it, expect } from 'vitest'

import { calculateWilsonScore, calculateQuality } from './quality-scorer'

describe('Quality Scorer', () => {
  describe('calculateWilsonScore', () => {
    it('should return 0 for 0 votes', () => {
      expect(calculateWilsonScore(0, 0)).toBe(0)
    })

    it('should return higher score for more positive ratio', () => {
      const score1 = calculateWilsonScore(100, 0) // 100% positive
      const score2 = calculateWilsonScore(50, 50) // 50% positive
      expect(score1).toBeGreaterThan(score2)
    })

    it('should return higher score for more votes with same ratio', () => {
      const score1 = calculateWilsonScore(100, 0) // 100% positive, 100 votes
      const score2 = calculateWilsonScore(10, 0) // 100% positive, 10 votes
      // Wilson score penalizes uncertainty (fewer votes)
      expect(score1).toBeGreaterThan(score2)
    })

    it('should handle extreme cases', () => {
      expect(calculateWilsonScore(1000000, 0)).toBeGreaterThan(99)
      expect(calculateWilsonScore(0, 1000000)).toBeLessThan(1)
    })

    it('should return score between 0 and 100', () => {
      const score = calculateWilsonScore(123, 45)
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(100)
    })
  })

  describe('calculateQuality', () => {
    it('should be an alias for calculateWilsonScore', () => {
      expect(calculateQuality(100, 10)).toBe(calculateWilsonScore(100, 10))
    })
  })
})
