import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  detectLoginState,
  detectCaptcha,
  detectRateLimit,
  detectProblemPage,
  detectEditorialPage,
  detectDiscussionPage,
  detectErrorPage,
  waitForState,
  detectPremiumRequired,
  type LoginState,
} from '../detectors'
import type { PlaywrightDriver } from '../playwright-driver'

// Mock logger
vi.mock('@lesca/shared/utils', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

// Create mock page
const createMockPage = (evaluateResult: unknown = {}) => ({
  evaluate: vi.fn().mockResolvedValue(evaluateResult),
})

// Create mock driver
const createMockDriver = (page: ReturnType<typeof createMockPage> | null = createMockPage()) =>
  ({
    getPage: vi.fn().mockReturnValue(page),
  }) as unknown as PlaywrightDriver

describe('detectLoginState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return logged-in when avatar is present', async () => {
    const mockPage = createMockPage({
      hasAvatar: true,
      hasUserDropdown: false,
      hasProfileLink: false,
      hasLoginForm: false,
      hasSignInButton: false,
      hasCaptcha: false,
      hasRateLimit: false,
    })
    const driver = createMockDriver(mockPage)

    const state = await detectLoginState(driver)

    expect(state).toBe('logged-in')
  })

  it('should return logged-in when user dropdown is present', async () => {
    const mockPage = createMockPage({
      hasAvatar: false,
      hasUserDropdown: true,
      hasProfileLink: false,
      hasLoginForm: false,
      hasSignInButton: false,
      hasCaptcha: false,
      hasRateLimit: false,
    })
    const driver = createMockDriver(mockPage)

    const state = await detectLoginState(driver)

    expect(state).toBe('logged-in')
  })

  it('should return logged-in when profile link is present', async () => {
    const mockPage = createMockPage({
      hasAvatar: false,
      hasUserDropdown: false,
      hasProfileLink: true,
      hasLoginForm: false,
      hasSignInButton: false,
      hasCaptcha: false,
      hasRateLimit: false,
    })
    const driver = createMockDriver(mockPage)

    const state = await detectLoginState(driver)

    expect(state).toBe('logged-in')
  })

  it('should return logged-out when login form is present', async () => {
    const mockPage = createMockPage({
      hasAvatar: false,
      hasUserDropdown: false,
      hasProfileLink: false,
      hasLoginForm: true,
      hasSignInButton: false,
      hasCaptcha: false,
      hasRateLimit: false,
    })
    const driver = createMockDriver(mockPage)

    const state = await detectLoginState(driver)

    expect(state).toBe('logged-out')
  })

  it('should return logged-out when sign-in button is present', async () => {
    const mockPage = createMockPage({
      hasAvatar: false,
      hasUserDropdown: false,
      hasProfileLink: false,
      hasLoginForm: false,
      hasSignInButton: true,
      hasCaptcha: false,
      hasRateLimit: false,
    })
    const driver = createMockDriver(mockPage)

    const state = await detectLoginState(driver)

    expect(state).toBe('logged-out')
  })

  it('should return captcha when CAPTCHA is detected', async () => {
    const mockPage = createMockPage({
      hasAvatar: false,
      hasUserDropdown: false,
      hasProfileLink: false,
      hasLoginForm: false,
      hasSignInButton: false,
      hasCaptcha: true,
      hasRateLimit: false,
    })
    const driver = createMockDriver(mockPage)

    const state = await detectLoginState(driver)

    expect(state).toBe('captcha')
  })

  it('should return rate-limited when rate limit is detected', async () => {
    const mockPage = createMockPage({
      hasAvatar: false,
      hasUserDropdown: false,
      hasProfileLink: false,
      hasLoginForm: false,
      hasSignInButton: false,
      hasCaptcha: false,
      hasRateLimit: true,
    })
    const driver = createMockDriver(mockPage)

    const state = await detectLoginState(driver)

    expect(state).toBe('rate-limited')
  })

  it('should prioritize captcha over rate-limit', async () => {
    const mockPage = createMockPage({
      hasAvatar: false,
      hasUserDropdown: false,
      hasProfileLink: false,
      hasLoginForm: false,
      hasSignInButton: false,
      hasCaptcha: true,
      hasRateLimit: true,
    })
    const driver = createMockDriver(mockPage)

    const state = await detectLoginState(driver)

    expect(state).toBe('captcha')
  })

  it('should return unknown when no page available', async () => {
    const driver = createMockDriver(null)

    const state = await detectLoginState(driver)

    expect(state).toBe('unknown')
  })

  it('should return unknown when no indicators match', async () => {
    const mockPage = createMockPage({
      hasAvatar: false,
      hasUserDropdown: false,
      hasProfileLink: false,
      hasLoginForm: false,
      hasSignInButton: false,
      hasCaptcha: false,
      hasRateLimit: false,
    })
    const driver = createMockDriver(mockPage)

    const state = await detectLoginState(driver)

    expect(state).toBe('unknown')
  })

  it('should return unknown on error', async () => {
    const mockPage = createMockPage()
    mockPage.evaluate.mockRejectedValue(new Error('Page error'))
    const driver = createMockDriver(mockPage)

    const state = await detectLoginState(driver)

    expect(state).toBe('unknown')
  })
})

describe('detectCaptcha', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return true when CAPTCHA is present', async () => {
    const mockPage = createMockPage(true)
    const driver = createMockDriver(mockPage)

    const result = await detectCaptcha(driver)

    expect(result).toBe(true)
  })

  it('should return false when no CAPTCHA', async () => {
    const mockPage = createMockPage(false)
    const driver = createMockDriver(mockPage)

    const result = await detectCaptcha(driver)

    expect(result).toBe(false)
  })

  it('should return false when no page available', async () => {
    const driver = createMockDriver(null)

    const result = await detectCaptcha(driver)

    expect(result).toBe(false)
  })

  it('should return false on error', async () => {
    const mockPage = createMockPage()
    mockPage.evaluate.mockRejectedValue(new Error('Page error'))
    const driver = createMockDriver(mockPage)

    const result = await detectCaptcha(driver)

    expect(result).toBe(false)
  })
})

describe('detectRateLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return true when rate limit detected', async () => {
    const mockPage = createMockPage(true)
    const driver = createMockDriver(mockPage)

    const result = await detectRateLimit(driver)

    expect(result).toBe(true)
  })

  it('should return false when no rate limit', async () => {
    const mockPage = createMockPage(false)
    const driver = createMockDriver(mockPage)

    const result = await detectRateLimit(driver)

    expect(result).toBe(false)
  })

  it('should return false when no page available', async () => {
    const driver = createMockDriver(null)

    const result = await detectRateLimit(driver)

    expect(result).toBe(false)
  })

  it('should return false on error', async () => {
    const mockPage = createMockPage()
    mockPage.evaluate.mockRejectedValue(new Error('Page error'))
    const driver = createMockDriver(mockPage)

    const result = await detectRateLimit(driver)

    expect(result).toBe(false)
  })
})

describe('detectProblemPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return true when problem page elements found', async () => {
    const mockPage = createMockPage(true)
    const driver = createMockDriver(mockPage)

    const result = await detectProblemPage(driver)

    expect(result).toBe(true)
  })

  it('should return false when not a problem page', async () => {
    const mockPage = createMockPage(false)
    const driver = createMockDriver(mockPage)

    const result = await detectProblemPage(driver)

    expect(result).toBe(false)
  })

  it('should return false when no page available', async () => {
    const driver = createMockDriver(null)

    const result = await detectProblemPage(driver)

    expect(result).toBe(false)
  })

  it('should return false on error', async () => {
    const mockPage = createMockPage()
    mockPage.evaluate.mockRejectedValue(new Error('Page error'))
    const driver = createMockDriver(mockPage)

    const result = await detectProblemPage(driver)

    expect(result).toBe(false)
  })
})

describe('detectEditorialPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return true when editorial page elements found', async () => {
    const mockPage = createMockPage(true)
    const driver = createMockDriver(mockPage)

    const result = await detectEditorialPage(driver)

    expect(result).toBe(true)
  })

  it('should return false when not an editorial page', async () => {
    const mockPage = createMockPage(false)
    const driver = createMockDriver(mockPage)

    const result = await detectEditorialPage(driver)

    expect(result).toBe(false)
  })

  it('should return false when no page available', async () => {
    const driver = createMockDriver(null)

    const result = await detectEditorialPage(driver)

    expect(result).toBe(false)
  })

  it('should return false on error', async () => {
    const mockPage = createMockPage()
    mockPage.evaluate.mockRejectedValue(new Error('Page error'))
    const driver = createMockDriver(mockPage)

    const result = await detectEditorialPage(driver)

    expect(result).toBe(false)
  })
})

describe('detectDiscussionPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return true when discussion page elements found', async () => {
    const mockPage = createMockPage(true)
    const driver = createMockDriver(mockPage)

    const result = await detectDiscussionPage(driver)

    expect(result).toBe(true)
  })

  it('should return false when not a discussion page', async () => {
    const mockPage = createMockPage(false)
    const driver = createMockDriver(mockPage)

    const result = await detectDiscussionPage(driver)

    expect(result).toBe(false)
  })

  it('should return false when no page available', async () => {
    const driver = createMockDriver(null)

    const result = await detectDiscussionPage(driver)

    expect(result).toBe(false)
  })

  it('should return false on error', async () => {
    const mockPage = createMockPage()
    mockPage.evaluate.mockRejectedValue(new Error('Page error'))
    const driver = createMockDriver(mockPage)

    const result = await detectDiscussionPage(driver)

    expect(result).toBe(false)
  })
})

describe('detectErrorPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return true when error page detected', async () => {
    const mockPage = createMockPage(true)
    const driver = createMockDriver(mockPage)

    const result = await detectErrorPage(driver)

    expect(result).toBe(true)
  })

  it('should return false when no error', async () => {
    const mockPage = createMockPage(false)
    const driver = createMockDriver(mockPage)

    const result = await detectErrorPage(driver)

    expect(result).toBe(false)
  })

  it('should return false when no page available', async () => {
    const driver = createMockDriver(null)

    const result = await detectErrorPage(driver)

    expect(result).toBe(false)
  })

  it('should return false on evaluation error', async () => {
    const mockPage = createMockPage()
    mockPage.evaluate.mockRejectedValue(new Error('Page error'))
    const driver = createMockDriver(mockPage)

    const result = await detectErrorPage(driver)

    expect(result).toBe(false)
  })
})

describe('detectPremiumRequired', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return true when premium is required', async () => {
    const mockPage = createMockPage(true)
    const driver = createMockDriver(mockPage)

    const result = await detectPremiumRequired(driver)

    expect(result).toBe(true)
  })

  it('should return false when premium not required', async () => {
    const mockPage = createMockPage(false)
    const driver = createMockDriver(mockPage)

    const result = await detectPremiumRequired(driver)

    expect(result).toBe(false)
  })

  it('should return false when no page available', async () => {
    const driver = createMockDriver(null)

    const result = await detectPremiumRequired(driver)

    expect(result).toBe(false)
  })

  it('should return false on error', async () => {
    const mockPage = createMockPage()
    mockPage.evaluate.mockRejectedValue(new Error('Page error'))
    const driver = createMockDriver(mockPage)

    const result = await detectPremiumRequired(driver)

    expect(result).toBe(false)
  })
})

describe('waitForState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  it('should return true when expected state is reached', async () => {
    const mockPage = createMockPage({
      hasAvatar: true,
      hasUserDropdown: false,
      hasProfileLink: false,
      hasLoginForm: false,
      hasSignInButton: false,
      hasCaptcha: false,
      hasRateLimit: false,
    })
    const driver = createMockDriver(mockPage)

    const promise = waitForState(driver, 'logged-in', 5000)
    await vi.runOnlyPendingTimersAsync()

    const result = await promise

    expect(result).toBe(true)
  })

  it('should return false when timeout exceeded', async () => {
    const mockPage = createMockPage({
      hasAvatar: false,
      hasUserDropdown: false,
      hasProfileLink: false,
      hasLoginForm: false,
      hasSignInButton: false,
      hasCaptcha: false,
      hasRateLimit: false,
    })
    const driver = createMockDriver(mockPage)

    const promise = waitForState(driver, 'logged-in', 1000)

    // Advance time past timeout
    await vi.advanceTimersByTimeAsync(1500)

    const result = await promise

    expect(result).toBe(false)
  })

  it('should wait for state with multiple checks', async () => {
    let callCount = 0
    const mockPage = createMockPage()
    mockPage.evaluate.mockImplementation(() => {
      callCount++
      // Return logged-in on 3rd call
      if (callCount >= 3) {
        return {
          hasAvatar: true,
          hasUserDropdown: false,
          hasProfileLink: false,
          hasLoginForm: false,
          hasSignInButton: false,
          hasCaptcha: false,
          hasRateLimit: false,
        }
      }
      return {
        hasAvatar: false,
        hasUserDropdown: false,
        hasProfileLink: false,
        hasLoginForm: false,
        hasSignInButton: false,
        hasCaptcha: false,
        hasRateLimit: false,
      }
    })
    const driver = createMockDriver(mockPage)

    const promise = waitForState(driver, 'logged-in', 10000)

    // Advance through multiple polling intervals
    await vi.advanceTimersByTimeAsync(500) // 1st check
    await vi.advanceTimersByTimeAsync(500) // 2nd check
    await vi.advanceTimersByTimeAsync(500) // 3rd check - should succeed

    const result = await promise

    expect(result).toBe(true)
    expect(callCount).toBe(3)
  })

  afterEach(() => {
    vi.useRealTimers()
  })
})

describe('LoginState type', () => {
  it('should have correct type values', () => {
    const states: LoginState[] = ['logged-in', 'logged-out', 'captcha', 'rate-limited', 'unknown']

    expect(states).toHaveLength(5)
    expect(states).toContain('logged-in')
    expect(states).toContain('logged-out')
    expect(states).toContain('captcha')
    expect(states).toContain('rate-limited')
    expect(states).toContain('unknown')
  })
})
