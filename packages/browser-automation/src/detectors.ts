import { logger } from '@/shared/utils/src/index.js'

import type { PlaywrightDriver } from './playwright-driver.js'

/**
 * Login state types
 */
export type LoginState = 'logged-in' | 'logged-out' | 'captcha' | 'rate-limited' | 'unknown'

/**
 * Detect current login state on LeetCode
 */
export async function detectLoginState(driver: PlaywrightDriver): Promise<LoginState> {
  logger.debug('Detecting login state')

  try {
    const page = driver.getPage()
    if (!page) {
      return 'unknown'
    }

    // Check for various indicators
    const indicators = await page.evaluate(() => {
      // Check if user avatar/profile is present (logged in indicator)
      const hasAvatar = document.querySelector('[data-cy="avatar"]') !== null
      const hasUserDropdown = document.querySelector('.user-dropdown') !== null
      const hasProfileLink = document.querySelector('a[href*="/profile/"]') !== null

      // Check for login form (logged out indicator)
      const hasLoginForm = document.querySelector('input[name="login"]') !== null
      const hasSignInButton = document.querySelector('button:has-text("Sign in")') !== null

      // Check for CAPTCHA
      const hasCaptcha =
        document.querySelector('.cf-turnstile') !== null ||
        document.querySelector('[id*="captcha"]') !== null ||
        document.querySelector('iframe[src*="captcha"]') !== null ||
        document.querySelector('.g-recaptcha') !== null

      // Check for rate limit messages
      const hasRateLimit =
        document.body.textContent?.includes('Too many requests') ||
        document.body.textContent?.includes('Rate limit') ||
        document.body.textContent?.includes('Please try again later') ||
        false

      return {
        hasAvatar,
        hasUserDropdown,
        hasProfileLink,
        hasLoginForm,
        hasSignInButton,
        hasCaptcha,
        hasRateLimit,
      }
    })

    // Determine state based on indicators
    if (indicators.hasCaptcha) {
      logger.debug('CAPTCHA detected')
      return 'captcha'
    }

    if (indicators.hasRateLimit) {
      logger.debug('Rate limit detected')
      return 'rate-limited'
    }

    if (indicators.hasAvatar || indicators.hasUserDropdown || indicators.hasProfileLink) {
      logger.debug('Logged in state detected')
      return 'logged-in'
    }

    if (indicators.hasLoginForm || indicators.hasSignInButton) {
      logger.debug('Logged out state detected')
      return 'logged-out'
    }

    logger.debug('Unable to determine login state')
    return 'unknown'
  } catch (error) {
    logger.warn('Error detecting login state', { error })
    return 'unknown'
  }
}

/**
 * Detect CAPTCHA presence on page
 */
export async function detectCaptcha(driver: PlaywrightDriver): Promise<boolean> {
  logger.debug('Detecting CAPTCHA')

  try {
    const page = driver.getPage()
    if (!page) {
      return false
    }

    const hasCaptcha = await page.evaluate(() => {
      // Check for various CAPTCHA implementations
      const cloudflare = document.querySelector('.cf-turnstile') !== null
      const recaptcha = document.querySelector('.g-recaptcha') !== null
      const hcaptcha = document.querySelector('.h-captcha') !== null
      const genericCaptcha =
        document.querySelector('[id*="captcha"]') !== null ||
        document.querySelector('iframe[src*="captcha"]') !== null

      return cloudflare || recaptcha || hcaptcha || genericCaptcha
    })

    if (hasCaptcha) {
      logger.info('CAPTCHA detected on page')
    }

    return hasCaptcha
  } catch (error) {
    logger.warn('Error detecting CAPTCHA', { error })
    return false
  }
}

/**
 * Detect rate limiting on page
 */
export async function detectRateLimit(driver: PlaywrightDriver): Promise<boolean> {
  logger.debug('Detecting rate limit')

  try {
    const page = driver.getPage()
    if (!page) {
      return false
    }

    const hasRateLimit = await page.evaluate(() => {
      const text = document.body.textContent || ''

      // Check for common rate limit messages
      const rateLimitPhrases = [
        'Too many requests',
        'Rate limit exceeded',
        'Please try again later',
        'Too many attempts',
        'Slow down',
        '429',
      ]

      return rateLimitPhrases.some((phrase) =>
        text.toLowerCase().includes(phrase.toLowerCase())
      )
    })

    if (hasRateLimit) {
      logger.warn('Rate limit detected on page')
    }

    return hasRateLimit
  } catch (error) {
    logger.warn('Error detecting rate limit', { error })
    return false
  }
}

/**
 * Detect if a problem page has loaded successfully
 */
export async function detectProblemPage(driver: PlaywrightDriver): Promise<boolean> {
  logger.debug('Detecting problem page')

  try {
    const page = driver.getPage()
    if (!page) {
      return false
    }

    const isProblemPage = await page.evaluate(() => {
      // Check for problem-specific elements
      const hasProblemTitle = document.querySelector('[data-cy="question-title"]') !== null
      const hasProblemDescription =
        document.querySelector('[data-track-load="description"]') !== null ||
        document.querySelector('.elfjS') !== null // Problem description container
      const hasCodeEditor = document.querySelector('.monaco-editor') !== null

      return hasProblemTitle || hasProblemDescription || hasCodeEditor
    })

    logger.debug(`Problem page detection: ${isProblemPage}`)
    return isProblemPage
  } catch (error) {
    logger.warn('Error detecting problem page', { error })
    return false
  }
}

/**
 * Detect if an editorial/solution page has loaded
 */
export async function detectEditorialPage(driver: PlaywrightDriver): Promise<boolean> {
  logger.debug('Detecting editorial page')

  try {
    const page = driver.getPage()
    if (!page) {
      return false
    }

    const isEditorialPage = await page.evaluate(() => {
      // Check for editorial-specific elements
      const hasSolutionTab =
        document.querySelector('[data-cy="solution-tab"]') !== null ||
        document.querySelector('a[href*="/solution/"]') !== null

      const hasSolutionContent =
        document.querySelector('.solution-content') !== null ||
        document.querySelector('[data-track-load="solution"]') !== null

      return hasSolutionTab || hasSolutionContent
    })

    logger.debug(`Editorial page detection: ${isEditorialPage}`)
    return isEditorialPage
  } catch (error) {
    logger.warn('Error detecting editorial page', { error })
    return false
  }
}

/**
 * Detect if discussion page has loaded
 */
export async function detectDiscussionPage(driver: PlaywrightDriver): Promise<boolean> {
  logger.debug('Detecting discussion page')

  try {
    const page = driver.getPage()
    if (!page) {
      return false
    }

    const isDiscussionPage = await page.evaluate(() => {
      // Check for discussion-specific elements
      const hasDiscussionTab =
        document.querySelector('[data-cy="discuss-tab"]') !== null ||
        document.querySelector('a[href*="/discuss/"]') !== null

      const hasTopicList =
        document.querySelector('.topic-list') !== null ||
        document.querySelector('[data-track-load="discuss"]') !== null

      return hasDiscussionTab || hasTopicList
    })

    logger.debug(`Discussion page detection: ${isDiscussionPage}`)
    return isDiscussionPage
  } catch (error) {
    logger.warn('Error detecting discussion page', { error })
    return false
  }
}

/**
 * Detect if a 404 or error page is shown
 */
export async function detectErrorPage(driver: PlaywrightDriver): Promise<boolean> {
  logger.debug('Detecting error page')

  try {
    const page = driver.getPage()
    if (!page) {
      return false
    }

    const isErrorPage = await page.evaluate(() => {
      const text = document.body.textContent || ''

      // Check for error messages
      const errorPhrases = [
        '404',
        'Page not found',
        'Not found',
        'Error',
        'Something went wrong',
        'Oops',
      ]

      return errorPhrases.some((phrase) =>
        text.toLowerCase().includes(phrase.toLowerCase())
      )
    })

    if (isErrorPage) {
      logger.warn('Error page detected')
    }

    return isErrorPage
  } catch (error) {
    logger.warn('Error detecting error page', { error })
    return false
  }
}

/**
 * Wait for page to be in a specific state
 */
export async function waitForState(
  driver: PlaywrightDriver,
  expectedState: LoginState,
  timeout = 30000
): Promise<boolean> {
  logger.debug('Waiting for state', { expectedState, timeout })

  const startTime = Date.now()

  while (Date.now() - startTime < timeout) {
    const currentState = await detectLoginState(driver)

    if (currentState === expectedState) {
      logger.debug('Expected state reached', { state: expectedState })
      return true
    }

    // Wait a bit before checking again
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  logger.warn('Timeout waiting for state', { expectedState })
  return false
}

/**
 * Detect premium/subscription requirement
 */
export async function detectPremiumRequired(driver: PlaywrightDriver): Promise<boolean> {
  logger.debug('Detecting premium requirement')

  try {
    const page = driver.getPage()
    if (!page) {
      return false
    }

    const isPremiumRequired = await page.evaluate(() => {
      const text = document.body.textContent || ''

      // Check for premium/subscription messages
      const premiumPhrases = [
        'Premium',
        'Subscribe',
        'Upgrade to unlock',
        'LeetCode Premium',
        'locked',
      ]

      // Also check for lock icons
      const hasLockIcon =
        document.querySelector('[data-icon="lock"]') !== null ||
        document.querySelector('.fa-lock') !== null

      return (
        hasLockIcon ||
        premiumPhrases.some((phrase) => text.toLowerCase().includes(phrase.toLowerCase()))
      )
    })

    if (isPremiumRequired) {
      logger.info('Premium subscription required for this content')
    }

    return isPremiumRequired
  } catch (error) {
    logger.warn('Error detecting premium requirement', { error })
    return false
  }
}
