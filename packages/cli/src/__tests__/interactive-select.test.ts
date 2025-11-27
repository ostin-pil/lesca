import { describe, it, expect, vi, beforeEach } from 'vitest'
import inquirer from 'inquirer'

import { InteractiveSelector } from '../interactive-select'

// Mock inquirer
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
  },
}))

// Mock chalk
vi.mock('chalk', () => ({
  default: {
    cyan: (str: string) => str,
    gray: (str: string) => str,
    green: (str: string) => str,
    yellow: (str: string) => str,
    red: (str: string) => str,
  },
}))

describe('InteractiveSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('selectProblems', () => {
    it('should return empty array for empty input', async () => {
      const result = await InteractiveSelector.selectProblems([])
      expect(result).toEqual([])
    })

    it('should support multi-select mode', async () => {
      const problems = [
        {
          questionId: '1',
          questionFrontendId: '1',
          title: 'Two Sum',
          titleSlug: 'two-sum',
          difficulty: 'Easy',
          isPaidOnly: false,
        },
        {
          questionId: '2',
          questionFrontendId: '2',
          title: 'Add Two Numbers',
          titleSlug: 'add-two-numbers',
          difficulty: 'Medium',
          isPaidOnly: false,
        },
      ]

      vi.mocked(inquirer.prompt).mockResolvedValue({
        selected: ['two-sum', 'add-two-numbers'],
      })

      const result = await InteractiveSelector.selectProblems(problems)

      expect(result).toEqual(['two-sum', 'add-two-numbers'])
      expect(inquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'checkbox',
          name: 'selected',
        }),
      ])
    })

    it('should support single-select mode', async () => {
      const problems = [
        {
          questionId: '1',
          questionFrontendId: '1',
          title: 'Two Sum',
          titleSlug: 'two-sum',
          difficulty: 'Easy',
          isPaidOnly: false,
        },
      ]

      vi.mocked(inquirer.prompt).mockResolvedValue({
        selected: 'two-sum',
      })

      const result = await InteractiveSelector.selectProblems(problems, { multiSelect: false })

      expect(result).toEqual(['two-sum'])
      expect(inquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'list',
          name: 'selected',
        }),
      ])
    })

    it('should format premium problems with lock icon', async () => {
      const problems = [
        {
          questionId: '1',
          questionFrontendId: '1',
          title: 'Premium Problem',
          titleSlug: 'premium',
          difficulty: 'Hard',
          isPaidOnly: true,
        },
      ]

      vi.mocked(inquirer.prompt).mockResolvedValue({
        selected: ['premium'],
      })

      await InteractiveSelector.selectProblems(problems)

      // Verify inquirer was called with formatted choices
      expect(inquirer.prompt).toHaveBeenCalled()
    })
  })

  describe('confirm', () => {
    it('should return true on confirmation', async () => {
      vi.mocked(inquirer.prompt).mockResolvedValue({
        confirmed: true,
      })

      const result = await InteractiveSelector.confirm('Are you sure?')

      expect(result).toBe(true)
    })

    it('should return false on rejection', async () => {
      vi.mocked(inquirer.prompt).mockResolvedValue({
        confirmed: false,
      })

      const result = await InteractiveSelector.confirm('Delete everything?', false)

      expect(result).toBe(false)
    })

    it('should use default value', async () => {
      vi.mocked(inquirer.prompt).mockResolvedValue({
        confirmed: true,
      })

      await InteractiveSelector.confirm('Proceed?', true)

      expect(inquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          default: true,
        }),
      ])
    })
  })
})
