import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Page } from 'playwright'
import { StealthManager } from '../stealth/stealth-manager'
import {
  calculateDelay,
  resolveTimingConfig,
  createDelayFunction,
  createTypingDelay,
} from '../stealth/timing-utils'
import {
  getRandomUserAgent,
  removeHeadlessSignature,
  getUserAgent,
  getPlatformFromUserAgent,
  USER_AGENTS,
  DEFAULT_USER_AGENT,
} from '../stealth/user-agents'
import {
  STEALTH_LAUNCH_ARGS,
  getStealthLaunchArgs,
  resolveLaunchArgsConfig,
} from '../stealth/launch-args'
import {
  getEvasionScripts,
  getEnabledEvasionScripts,
  resolveEvasionConfig,
} from '../stealth/evasion-scripts'

vi.mock('@lesca/shared/utils', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe('StealthManager', () => {
  describe('constructor', () => {
    it('should use default config when not provided', () => {
      const manager = new StealthManager()
      const config = manager.getConfig()

      expect(config.enabled).toBe(false)
      expect(config.evasions.webdriver).toBe(true)
      expect(config.evasions.chromeRuntime).toBe(true)
      expect(config.timing.enabled).toBe(false)
    })

    it('should merge provided config with defaults', () => {
      const manager = new StealthManager({
        enabled: true,
        evasions: { webdriver: false },
      })
      const config = manager.getConfig()

      expect(config.enabled).toBe(true)
      expect(config.evasions.webdriver).toBe(false)
      expect(config.evasions.chromeRuntime).toBe(true) // default preserved
    })

    it('should enable all default evasions', () => {
      const manager = new StealthManager({ enabled: true })
      const config = manager.getConfig()

      expect(config.evasions.webdriver).toBe(true)
      expect(config.evasions.chromeRuntime).toBe(true)
      expect(config.evasions.chromePermissions).toBe(true)
      expect(config.evasions.plugins).toBe(true)
      expect(config.evasions.languages).toBe(true)
      expect(config.evasions.iframeContentWindow).toBe(true)
      // These are off by default
      expect(config.evasions.webglVendor).toBe(false)
      expect(config.evasions.canvas).toBe(false)
      expect(config.evasions.mediaCodecs).toBe(false)
    })
  })

  describe('isEnabled', () => {
    it('should return false when disabled', () => {
      const manager = new StealthManager({ enabled: false })
      expect(manager.isEnabled()).toBe(false)
    })

    it('should return true when enabled', () => {
      const manager = new StealthManager({ enabled: true })
      expect(manager.isEnabled()).toBe(true)
    })
  })

  describe('getLaunchArgs', () => {
    it('should return empty array when disabled', () => {
      const manager = new StealthManager({ enabled: false })
      expect(manager.getLaunchArgs()).toEqual([])
    })

    it('should return stealth args when enabled', () => {
      const manager = new StealthManager({ enabled: true })
      const args = manager.getLaunchArgs()

      expect(args).toContain('--disable-blink-features=AutomationControlled')
      expect(args).toContain('--disable-infobars')
    })

    it('should include additional args', () => {
      const manager = new StealthManager({
        enabled: true,
        launchArgs: { additionalArgs: ['--custom-arg'] },
      })
      const args = manager.getLaunchArgs()

      expect(args).toContain('--custom-arg')
    })

    it('should not include stealth args when suppressAutomationFlags is false', () => {
      const manager = new StealthManager({
        enabled: true,
        launchArgs: {
          suppressAutomationFlags: false,
          additionalArgs: ['--custom-arg'],
        },
      })
      const args = manager.getLaunchArgs()

      expect(args).not.toContain('--disable-blink-features=AutomationControlled')
      expect(args).toContain('--custom-arg')
    })
  })

  describe('getUserAgent', () => {
    it('should return empty string when disabled', () => {
      const manager = new StealthManager({ enabled: false })
      expect(manager.getUserAgent()).toBe('')
    })

    it('should return provided user agent with headless removed', () => {
      const manager = new StealthManager({ enabled: true })
      const ua = manager.getUserAgent('Mozilla/5.0 HeadlessChrome/120.0.0.0 Safari/537.36')

      expect(ua).not.toContain('Headless')
      expect(ua).toContain('Chrome')
    })

    it('should use custom user agent when provided', () => {
      const manager = new StealthManager({
        enabled: true,
        userAgent: { custom: 'Custom UA' },
      })
      expect(manager.getUserAgent()).toBe('Custom UA')
    })

    it('should return random UA when rotation enabled', () => {
      const manager = new StealthManager({
        enabled: true,
        userAgent: { rotate: true },
      })
      const ua = manager.getUserAgent()

      expect(USER_AGENTS).toContain(ua)
    })
  })

  describe('getEnabledEvasions', () => {
    it('should return list of enabled evasion names', () => {
      const manager = new StealthManager({
        enabled: true,
        evasions: {
          webdriver: true,
          chromeRuntime: true,
          plugins: false,
        },
      })
      const enabled = manager.getEnabledEvasions()

      expect(enabled).toContain('webdriver')
      expect(enabled).toContain('chromeRuntime')
      expect(enabled).not.toContain('plugins')
    })
  })

  describe('applyToPage', () => {
    let mockPage: Page

    beforeEach(() => {
      mockPage = {
        addInitScript: vi.fn().mockResolvedValue(undefined),
      } as unknown as Page
    })

    it('should not apply scripts when disabled', async () => {
      const manager = new StealthManager({ enabled: false })
      await manager.applyToPage(mockPage)

      expect(mockPage.addInitScript).not.toHaveBeenCalled()
    })

    it('should apply webdriver evasion when enabled', async () => {
      const manager = new StealthManager({
        enabled: true,
        evasions: {
          webdriver: true,
          chromeRuntime: false,
          chromePermissions: false,
          plugins: false,
          languages: false,
          iframeContentWindow: false,
        },
      })
      await manager.applyToPage(mockPage)

      expect(mockPage.addInitScript).toHaveBeenCalledTimes(1)
    })

    it('should apply multiple evasions', async () => {
      const manager = new StealthManager({
        enabled: true,
        evasions: {
          webdriver: true,
          chromeRuntime: true,
          chromePermissions: false,
          plugins: false,
          languages: false,
          iframeContentWindow: false,
        },
      })
      await manager.applyToPage(mockPage)

      expect(mockPage.addInitScript).toHaveBeenCalledTimes(2)
    })
  })

  describe('getTimingConfig', () => {
    it('should return resolved timing config', () => {
      const manager = new StealthManager({
        enabled: true,
        timing: { enabled: true, minDelay: 100 },
      })
      const timing = manager.getTimingConfig()

      expect(timing.enabled).toBe(true)
      expect(timing.minDelay).toBe(100)
      expect(timing.maxDelay).toBe(200) // default
      expect(timing.jitter).toBe(true) // default
    })
  })
})

describe('Timing Utils', () => {
  describe('resolveTimingConfig', () => {
    it('should apply defaults when no config provided', () => {
      const config = resolveTimingConfig()

      expect(config.enabled).toBe(false)
      expect(config.minDelay).toBe(50)
      expect(config.maxDelay).toBe(200)
      expect(config.jitter).toBe(true)
    })

    it('should merge provided config with defaults', () => {
      const config = resolveTimingConfig({ enabled: true, minDelay: 100 })

      expect(config.enabled).toBe(true)
      expect(config.minDelay).toBe(100)
      expect(config.maxDelay).toBe(200) // default
    })
  })

  describe('calculateDelay', () => {
    it('should return 0 when disabled', () => {
      const delay = calculateDelay({
        enabled: false,
        minDelay: 50,
        maxDelay: 200,
        jitter: true,
      })
      expect(delay).toBe(0)
    })

    it('should return delay within range without jitter', () => {
      const config = {
        enabled: true,
        minDelay: 50,
        maxDelay: 100,
        jitter: false,
      }

      for (let i = 0; i < 100; i++) {
        const delay = calculateDelay(config)
        expect(delay).toBeGreaterThanOrEqual(50)
        expect(delay).toBeLessThanOrEqual(100)
      }
    })

    it('should return delay with jitter applied', () => {
      const config = {
        enabled: true,
        minDelay: 100,
        maxDelay: 100,
        jitter: true,
      }

      // With jitter, values should vary
      const delays = Array.from({ length: 100 }, () => calculateDelay(config))
      const uniqueDelays = new Set(delays)

      // Should have some variation
      expect(uniqueDelays.size).toBeGreaterThan(1)
    })
  })

  describe('createDelayFunction', () => {
    it('should create a function that returns a promise', async () => {
      const delay = createDelayFunction({ enabled: false })
      const result = delay()

      expect(result).toBeInstanceOf(Promise)
      await result // Should resolve immediately
    })
  })

  describe('createTypingDelay', () => {
    it('should return a function that generates delays', () => {
      const typingDelay = createTypingDelay(80, 0.3)

      for (let i = 0; i < 100; i++) {
        const delay = typingDelay()
        expect(typeof delay).toBe('number')
        expect(delay).toBeGreaterThan(0)
      }
    })

    it('should generate variable delays with variance', () => {
      const typingDelay = createTypingDelay(80, 0.5)
      const delays = Array.from({ length: 100 }, () => typingDelay())
      const uniqueDelays = new Set(delays)

      expect(uniqueDelays.size).toBeGreaterThan(1)
    })
  })
})

describe('User Agent Utils', () => {
  describe('USER_AGENTS', () => {
    it('should have at least 10 user agents', () => {
      expect(USER_AGENTS.length).toBeGreaterThanOrEqual(10)
    })

    it('should all contain Chrome', () => {
      USER_AGENTS.forEach((ua) => {
        expect(ua).toContain('Chrome')
      })
    })
  })

  describe('getRandomUserAgent', () => {
    it('should return a user agent from the pool', () => {
      const ua = getRandomUserAgent()
      expect(USER_AGENTS).toContain(ua)
    })

    it('should return different values over multiple calls', () => {
      const uas = Array.from({ length: 50 }, () => getRandomUserAgent())
      const uniqueUas = new Set(uas)

      // Should get at least 2 different UAs over 50 calls
      expect(uniqueUas.size).toBeGreaterThan(1)
    })
  })

  describe('removeHeadlessSignature', () => {
    it('should remove HeadlessChrome', () => {
      const result = removeHeadlessSignature('Mozilla/5.0 HeadlessChrome/120.0.0.0 Safari/537.36')
      expect(result).not.toContain('Headless')
      expect(result).toContain('Chrome')
    })

    it('should handle lowercase headless', () => {
      const result = removeHeadlessSignature('Some headless browser')
      expect(result).not.toContain('headless')
    })

    it('should not modify clean user agents', () => {
      const clean = 'Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36'
      const result = removeHeadlessSignature(clean)
      expect(result).toBe(clean)
    })
  })

  describe('getUserAgent', () => {
    it('should return custom UA when provided', () => {
      const result = getUserAgent({
        rotate: false,
        custom: 'My Custom UA',
        removeHeadless: false,
      })
      expect(result).toBe('My Custom UA')
    })

    it('should return random UA when rotation enabled', () => {
      const result = getUserAgent({
        rotate: true,
        custom: '',
        removeHeadless: false,
      })
      expect(USER_AGENTS).toContain(result)
    })

    it('should use current UA as fallback', () => {
      const result = getUserAgent(
        { rotate: false, custom: '', removeHeadless: false },
        'Current UA'
      )
      expect(result).toBe('Current UA')
    })

    it('should remove headless signature when configured', () => {
      const result = getUserAgent(
        { rotate: false, custom: '', removeHeadless: true },
        'HeadlessChrome/120'
      )
      expect(result).not.toContain('Headless')
    })
  })

  describe('getPlatformFromUserAgent', () => {
    it('should return Win32 for Windows UA', () => {
      expect(getPlatformFromUserAgent('Mozilla/5.0 (Windows NT 10.0)')).toBe('Win32')
    })

    it('should return MacIntel for macOS UA', () => {
      expect(getPlatformFromUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X)')).toBe('MacIntel')
    })

    it('should return Linux x86_64 for Linux UA', () => {
      expect(getPlatformFromUserAgent('Mozilla/5.0 (X11; Linux x86_64)')).toBe('Linux x86_64')
    })

    it('should default to Win32 for unknown', () => {
      expect(getPlatformFromUserAgent('Unknown UA')).toBe('Win32')
    })
  })
})

describe('Launch Args', () => {
  describe('STEALTH_LAUNCH_ARGS', () => {
    it('should include automation suppression flag', () => {
      expect(STEALTH_LAUNCH_ARGS).toContain('--disable-blink-features=AutomationControlled')
    })

    it('should include infobars suppression', () => {
      expect(STEALTH_LAUNCH_ARGS).toContain('--disable-infobars')
    })

    it('should have at least 10 args', () => {
      expect(STEALTH_LAUNCH_ARGS.length).toBeGreaterThanOrEqual(10)
    })
  })

  describe('resolveLaunchArgsConfig', () => {
    it('should apply defaults', () => {
      const config = resolveLaunchArgsConfig()

      expect(config.suppressAutomationFlags).toBe(true)
      expect(config.additionalArgs).toEqual([])
    })

    it('should merge provided config', () => {
      const config = resolveLaunchArgsConfig({
        suppressAutomationFlags: false,
        additionalArgs: ['--test'],
      })

      expect(config.suppressAutomationFlags).toBe(false)
      expect(config.additionalArgs).toEqual(['--test'])
    })
  })

  describe('getStealthLaunchArgs', () => {
    it('should return stealth args when suppression enabled', () => {
      const args = getStealthLaunchArgs({
        suppressAutomationFlags: true,
        additionalArgs: [],
      })

      expect(args.length).toBeGreaterThan(0)
      expect(args).toContain('--disable-blink-features=AutomationControlled')
    })

    it('should return only additional args when suppression disabled', () => {
      const args = getStealthLaunchArgs({
        suppressAutomationFlags: false,
        additionalArgs: ['--test-arg'],
      })

      expect(args).toEqual(['--test-arg'])
    })

    it('should include both stealth and additional args', () => {
      const args = getStealthLaunchArgs({
        suppressAutomationFlags: true,
        additionalArgs: ['--custom'],
      })

      expect(args).toContain('--disable-blink-features=AutomationControlled')
      expect(args).toContain('--custom')
    })
  })
})

describe('Evasion Scripts', () => {
  describe('resolveEvasionConfig', () => {
    it('should apply defaults', () => {
      const config = resolveEvasionConfig()

      expect(config.webdriver).toBe(true)
      expect(config.chromeRuntime).toBe(true)
      expect(config.webglVendor).toBe(false)
      expect(config.canvas).toBe(false)
    })

    it('should merge provided config', () => {
      const config = resolveEvasionConfig({
        webdriver: false,
        canvas: true,
      })

      expect(config.webdriver).toBe(false)
      expect(config.canvas).toBe(true)
      expect(config.chromeRuntime).toBe(true) // default
    })
  })

  describe('getEvasionScripts', () => {
    it('should return all evasion script generators', () => {
      const scripts = getEvasionScripts()

      expect(typeof scripts.webdriver).toBe('function')
      expect(typeof scripts.chromeRuntime).toBe('function')
      expect(typeof scripts.chromePermissions).toBe('function')
      expect(typeof scripts.plugins).toBe('function')
      expect(typeof scripts.languages).toBe('function')
      expect(typeof scripts.iframeContentWindow).toBe('function')
      expect(typeof scripts.webglVendor).toBe('function')
      expect(typeof scripts.canvas).toBe('function')
      expect(typeof scripts.mediaCodecs).toBe('function')
    })

    it('should return valid JavaScript strings', () => {
      const scripts = getEvasionScripts()

      Object.values(scripts).forEach((getScript) => {
        const script = getScript()
        expect(typeof script).toBe('string')
        expect(script.length).toBeGreaterThan(0)
      })
    })
  })

  describe('getEnabledEvasionScripts', () => {
    it('should return empty array when all disabled', () => {
      const scripts = getEnabledEvasionScripts({
        webdriver: false,
        chromeRuntime: false,
        chromePermissions: false,
        plugins: false,
        languages: false,
        iframeContentWindow: false,
        webglVendor: false,
        canvas: false,
        mediaCodecs: false,
      })

      expect(scripts).toEqual([])
    })

    it('should return only enabled scripts', () => {
      const scripts = getEnabledEvasionScripts({
        webdriver: true,
        chromeRuntime: false,
        chromePermissions: false,
        plugins: false,
        languages: false,
        iframeContentWindow: false,
        webglVendor: false,
        canvas: false,
        mediaCodecs: false,
      })

      expect(scripts.length).toBe(1)
      expect(scripts[0]).toContain('webdriver')
    })

    it('should return all scripts when all enabled', () => {
      const scripts = getEnabledEvasionScripts({
        webdriver: true,
        chromeRuntime: true,
        chromePermissions: true,
        plugins: true,
        languages: true,
        iframeContentWindow: true,
        webglVendor: true,
        canvas: true,
        mediaCodecs: true,
      })

      expect(scripts.length).toBe(9)
    })
  })
})
