import type {
  Problem,
  ProblemScrapeRequest,
  EditorialScrapeRequest,
  DiscussionScrapeRequest,
  Difficulty,
} from '@lesca/shared/types'

/**
 * Factory for creating test Problem objects
 */
export function createProblem(overrides: Partial<Problem> = {}): Problem {
  return {
    questionId: '1',
    questionFrontendId: '1',
    title: 'Test Problem',
    titleSlug: 'test-problem',
    content: '<p>Test problem content</p>',
    difficulty: 'Easy' as Difficulty,
    exampleTestcases: 'test input\ntest output',
    hints: ['Test hint 1', 'Test hint 2'],
    topicTags: [
      { name: 'Array', slug: 'array' },
      { name: 'Hash Table', slug: 'hash-table' },
    ],
    companyTagStats: null,
    stats: JSON.stringify({
      totalAccepted: '1M',
      totalSubmission: '2M',
      totalAcceptedRaw: 1000000,
      totalSubmissionRaw: 2000000,
      acRate: '50.0%',
    }),
    codeSnippets: [
      {
        lang: 'Python3',
        langSlug: 'python3',
        code: 'def solution(self):\n    pass',
      },
      {
        lang: 'JavaScript',
        langSlug: 'javascript',
        code: 'function solution() {\n    // code here\n}',
      },
    ],
    similarQuestions: JSON.stringify([]),
    solution: null,
    mysqlSchemas: [],
    dataSchemas: [],
    ...overrides,
  }
}

/**
 * Factory for creating ProblemScrapeRequest
 */
export function createProblemRequest(
  overrides: Partial<ProblemScrapeRequest> = {}
): ProblemScrapeRequest {
  return {
    type: 'problem',
    titleSlug: 'test-problem',
    ...overrides,
  }
}

/**
 * Factory for creating EditorialScrapeRequest
 */
export function createEditorialRequest(
  overrides: Partial<EditorialScrapeRequest> = {}
): EditorialScrapeRequest {
  return {
    type: 'editorial',
    titleSlug: 'test-problem',
    ...overrides,
  }
}

/**
 * Factory for creating DiscussionScrapeRequest
 */
export function createDiscussionRequest(
  overrides: Partial<DiscussionScrapeRequest> = {}
): DiscussionScrapeRequest {
  return {
    type: 'discussion',
    titleSlug: 'test-problem',
    category: 'general',
    sortBy: 'hot',
    ...overrides,
  }
}

/**
 * Factory for creating batches of problems
 */
export function createProblems(count: number, overrides: Partial<Problem> = {}): Problem[] {
  return Array.from({ length: count }, (_, i) =>
    createProblem({
      questionId: String(i + 1),
      questionFrontendId: String(i + 1),
      title: `Test Problem ${i + 1}`,
      titleSlug: `test-problem-${i + 1}`,
      ...overrides,
    })
  )
}

/**
 * Factory for creating batches of scrape requests
 */
export function createProblemRequests(count: number): ProblemScrapeRequest[] {
  return Array.from({ length: count }, (_, i) =>
    createProblemRequest({
      titleSlug: `test-problem-${i + 1}`,
    })
  )
}
