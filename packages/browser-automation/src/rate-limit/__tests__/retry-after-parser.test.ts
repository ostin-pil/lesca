/**
 * Retry-After Parser Tests
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import { parseRetryAfter, isHttpDate, DEFAULT_MAX_RETRY_AFTER_MS } from '../retry-after-parser'

describe('retry-after-parser', () => {
  describe('parseRetryAfter', () => {
    describe('seconds format', () => {
      it('should parse integer seconds string', () => {
        expect(parseRetryAfter('120')).toBe(120000)
        expect(parseRetryAfter('0')).toBe(0)
        expect(parseRetryAfter('1')).toBe(1000)
        expect(parseRetryAfter('60')).toBe(60000)
      })

      it('should parse number input', () => {
        expect(parseRetryAfter(120)).toBe(120000)
        expect(parseRetryAfter(0)).toBe(0)
        expect(parseRetryAfter(1)).toBe(1000)
      })

      it('should handle whitespace', () => {
        expect(parseRetryAfter('  120  ')).toBe(120000)
        expect(parseRetryAfter('\t60\n')).toBe(60000)
      })
    })

    describe('HTTP-date format', () => {
      beforeEach(() => {
        vi.useFakeTimers()
        // Set current time to a known value
        vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'))
      })

      afterEach(() => {
        vi.useRealTimers()
      })

      it('should parse future HTTP-date', () => {
        // 1 minute in the future
        const futureDate = 'Mon, 01 Jan 2024 00:01:00 GMT'
        expect(parseRetryAfter(futureDate)).toBe(60000)
      })

      it('should return undefined for past HTTP-date', () => {
        const pastDate = 'Sun, 31 Dec 2023 23:59:00 GMT'
        expect(parseRetryAfter(pastDate)).toBeUndefined()
      })

      it('should handle various day names', () => {
        const dates = [
          'Mon, 01 Jan 2024 00:02:00 GMT',
          'Tue, 02 Jan 2024 00:00:00 GMT',
          'Wed, 03 Jan 2024 00:00:00 GMT',
        ]

        for (const date of dates) {
          const result = parseRetryAfter(date)
          expect(result).toBeDefined()
          expect(result).toBeGreaterThan(0)
        }
      })
    })

    describe('invalid values', () => {
      it('should return undefined for null', () => {
        expect(parseRetryAfter(null)).toBeUndefined()
      })

      it('should return undefined for undefined', () => {
        expect(parseRetryAfter(undefined)).toBeUndefined()
      })

      it('should return undefined for empty string', () => {
        expect(parseRetryAfter('')).toBeUndefined()
        expect(parseRetryAfter('   ')).toBeUndefined()
      })

      it('should return undefined for invalid string', () => {
        expect(parseRetryAfter('invalid')).toBeUndefined()
        expect(parseRetryAfter('abc123')).toBeUndefined()
        expect(parseRetryAfter('12.5')).toBeUndefined() // Floats not valid
        expect(parseRetryAfter('-10')).toBeUndefined() // Negative not valid
      })

      it('should return undefined for negative number', () => {
        expect(parseRetryAfter(-10)).toBeUndefined()
        expect(parseRetryAfter(-1)).toBeUndefined()
      })

      it('should return undefined for non-finite numbers', () => {
        expect(parseRetryAfter(Infinity)).toBeUndefined()
        expect(parseRetryAfter(-Infinity)).toBeUndefined()
        expect(parseRetryAfter(NaN)).toBeUndefined()
      })

      it('should return undefined for invalid date string', () => {
        expect(parseRetryAfter('not a date')).toBeUndefined()
        expect(parseRetryAfter('2024-01-01')).toBeUndefined() // ISO format not RFC 1123
      })
    })

    describe('maxMs capping', () => {
      it('should cap at default max', () => {
        // 5 minutes = 300000ms > default 120000ms
        expect(parseRetryAfter('300')).toBe(DEFAULT_MAX_RETRY_AFTER_MS)
      })

      it('should cap at custom max', () => {
        expect(parseRetryAfter('120', 60000)).toBe(60000)
        expect(parseRetryAfter(120, 60000)).toBe(60000)
      })

      it('should return value if under max', () => {
        expect(parseRetryAfter('30', 60000)).toBe(30000)
        expect(parseRetryAfter(30, 60000)).toBe(30000)
      })

      it('should cap HTTP-date results', () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'))

        // 5 minutes in the future
        const futureDate = 'Mon, 01 Jan 2024 00:05:00 GMT'
        expect(parseRetryAfter(futureDate, 60000)).toBe(60000)

        vi.useRealTimers()
      })
    })
  })

  describe('isHttpDate', () => {
    it('should return true for valid HTTP-date format', () => {
      expect(isHttpDate('Mon, 01 Jan 2024 00:00:00 GMT')).toBe(true)
      expect(isHttpDate('Tue, 15 Mar 2024 12:30:45 GMT')).toBe(true)
      expect(isHttpDate('Wed, 21 Oct 2015 07:28:00 GMT')).toBe(true)
    })

    it('should return true with leading whitespace', () => {
      expect(isHttpDate('  Mon, 01 Jan 2024 00:00:00 GMT')).toBe(true)
    })

    it('should return false for seconds format', () => {
      expect(isHttpDate('120')).toBe(false)
      expect(isHttpDate('0')).toBe(false)
    })

    it('should return false for other formats', () => {
      expect(isHttpDate('2024-01-01')).toBe(false)
      expect(isHttpDate('January 1, 2024')).toBe(false)
      expect(isHttpDate('')).toBe(false)
    })
  })
})
