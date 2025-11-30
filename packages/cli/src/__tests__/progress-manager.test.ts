import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SingleBar } from 'cli-progress'

import { ProgressManager } from '../progress-manager'

// Mock cli-progress
vi.mock('cli-progress', () => ({
  SingleBar: vi.fn().mockImplementation(() => ({
    start: vi.fn(),
    update: vi.fn(),
    increment: vi.fn(),
    stop: vi.fn(),
  })),
}))

// Mock logger
vi.mock('@lesca/shared/utils', () => ({
  logger: {
    log: vi.fn(),
  },
}))

describe('ProgressManager', () => {
  let manager: ProgressManager

  beforeEach(() => {
    vi.clearAllMocks()
    manager = new ProgressManager(100)
  })

  afterEach(() => {
    manager.stop()
  })

  describe('initialization', () => {
    it('should create progress bar with total', () => {
      expect(SingleBar).toHaveBeenCalled()
    })
  })

  describe('progress tracking', () => {
    it('should start progress bar', () => {
      const bar = vi.mocked(SingleBar).mock.results[0]?.value
      manager.start()

      expect(bar.start).toHaveBeenCalledWith(100, 0, expect.any(Object))
    })

    it('should update current item and status', () => {
      const bar = vi.mocked(SingleBar).mock.results[0]?.value

      manager.update({
        current: 'two-sum',
        status: 'fetching',
      })

      expect(bar.update).toHaveBeenCalled()
    })

    it('should increment on success', () => {
      const bar = vi.mocked(SingleBar).mock.results[0]?.value

      manager.incrementSuccess()

      expect(bar.update).toHaveBeenCalled()
    })

    it('should track cache hits', () => {
      manager.incrementSuccess(true)

      // Stats should be updated internally
      const summary = manager.getSummary()
      expect(summary).toContain('1/100')
    })

    it('should increment on failure', () => {
      const bar = vi.mocked(SingleBar).mock.results[0]?.value

      manager.incrementFailure()

      expect(bar.update).toHaveBeenCalled()
    })

    it('should increment on skip', () => {
      const bar = vi.mocked(SingleBar).mock.results[0]?.value

      manager.incrementSkip()

      expect(bar.update).toHaveBeenCalled()
    })
  })

  describe('summary', () => {
    it('should generate summary with correct counts', () => {
      manager.incrementSuccess()
      manager.incrementSuccess()
      manager.incrementFailure()

      const summary = manager.getSummary()

      expect(summary).toContain('2/100')
      expect(summary).toContain('Completed')
    })

    it('should show summary with timing', () => {
      const summary = manager.getSummary()

      expect(summary).toBeDefined()
      expect(typeof summary).toBe('string')
    })
  })

  describe('cleanup', () => {
    it('should stop progress bar', () => {
      const bar = vi.mocked(SingleBar).mock.results[0]?.value

      manager.stop()

      expect(bar.stop).toHaveBeenCalled()
    })
  })
})
