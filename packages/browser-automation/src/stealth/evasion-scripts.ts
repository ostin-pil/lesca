/**
 * Browser evasion scripts for stealth mode
 *
 * Contains JavaScript code that is injected into pages via addInitScript()
 * to mask browser automation signatures and evade bot detection.
 *
 * These scripts are based on techniques from puppeteer-extra-plugin-stealth
 * and adapted for Playwright.
 *
 * @module browser-automation/stealth/evasion-scripts
 */

import type { StealthEvasionConfig } from '@lesca/shared/types'

/**
 * Type for evasion script generator functions
 */
export type EvasionScript = () => string

/**
 * Collection of available evasion scripts
 */
export interface EvasionScripts {
  webdriver: EvasionScript
  chromeRuntime: EvasionScript
  chromePermissions: EvasionScript
  plugins: EvasionScript
  languages: EvasionScript
  iframeContentWindow: EvasionScript
  webglVendor: EvasionScript
  canvas: EvasionScript
  mediaCodecs: EvasionScript
}

/**
 * Resolved evasion configuration with defaults applied
 */
export interface ResolvedEvasionConfig {
  webdriver: boolean
  chromeRuntime: boolean
  chromePermissions: boolean
  plugins: boolean
  languages: boolean
  iframeContentWindow: boolean
  webglVendor: boolean
  canvas: boolean
  mediaCodecs: boolean
}

/**
 * Resolve evasion configuration with defaults
 *
 * @param config - User-provided configuration
 * @returns Resolved configuration with all defaults applied
 */
export function resolveEvasionConfig(config?: StealthEvasionConfig): ResolvedEvasionConfig {
  return {
    webdriver: config?.webdriver ?? true,
    chromeRuntime: config?.chromeRuntime ?? true,
    chromePermissions: config?.chromePermissions ?? true,
    plugins: config?.plugins ?? true,
    languages: config?.languages ?? true,
    iframeContentWindow: config?.iframeContentWindow ?? true,
    webglVendor: config?.webglVendor ?? false,
    canvas: config?.canvas ?? false,
    mediaCodecs: config?.mediaCodecs ?? false,
  }
}

/**
 * Remove navigator.webdriver property
 *
 * The webdriver property is set to true when the browser is controlled
 * by automation tools. This script removes or masks this property.
 */
export function getWebdriverEvasion(): string {
  return `
    // Remove navigator.webdriver
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
      configurable: true
    });

    // Also delete it if it exists
    if (navigator.webdriver) {
      delete Object.getPrototypeOf(navigator).webdriver;
    }
  `
}

/**
 * Emulate chrome.runtime and related Chrome APIs
 *
 * Real Chrome browsers have chrome.runtime, chrome.app, chrome.csi,
 * and chrome.loadTimes objects. Automated browsers often lack these.
 */
export function getChromeRuntimeEvasion(): string {
  return `
    // Create window.chrome if it doesn't exist
    if (!window.chrome) {
      window.chrome = {};
    }

    // Mock chrome.runtime
    if (!window.chrome.runtime) {
      window.chrome.runtime = {
        connect: function() {
          return {
            onMessage: { addListener: function() {} },
            onDisconnect: { addListener: function() {} },
            postMessage: function() {}
          };
        },
        sendMessage: function(message, responseCallback) {
          if (responseCallback) {
            responseCallback();
          }
        },
        onMessage: {
          addListener: function() {},
          removeListener: function() {},
          hasListener: function() { return false; }
        },
        onConnect: {
          addListener: function() {},
          removeListener: function() {}
        },
        id: undefined,
        getManifest: function() { return {}; },
        getURL: function(path) { return ''; },
        getPlatformInfo: function(callback) {
          callback({ os: 'win', arch: 'x86-64', nacl_arch: 'x86-64' });
        }
      };
    }

    // Mock chrome.app
    if (!window.chrome.app) {
      window.chrome.app = {
        isInstalled: false,
        InstallState: {
          DISABLED: 'disabled',
          INSTALLED: 'installed',
          NOT_INSTALLED: 'not_installed'
        },
        RunningState: {
          CANNOT_RUN: 'cannot_run',
          READY_TO_RUN: 'ready_to_run',
          RUNNING: 'running'
        },
        getDetails: function() { return null; },
        getIsInstalled: function() { return false; },
        runningState: function() { return 'cannot_run'; }
      };
    }

    // Mock chrome.csi (Connection State Information)
    if (!window.chrome.csi) {
      window.chrome.csi = function() {
        return {
          onloadT: Date.now(),
          pageT: Date.now() - performance.timing.navigationStart,
          startE: performance.timing.navigationStart,
          tran: 15
        };
      };
    }

    // Mock chrome.loadTimes
    if (!window.chrome.loadTimes) {
      window.chrome.loadTimes = function() {
        const timing = performance.timing;
        return {
          commitLoadTime: timing.responseStart / 1000,
          connectionInfo: 'http/1.1',
          finishDocumentLoadTime: timing.domContentLoadedEventEnd / 1000,
          finishLoadTime: timing.loadEventEnd / 1000,
          firstPaintAfterLoadTime: 0,
          firstPaintTime: timing.domContentLoadedEventStart / 1000,
          navigationType: 'Other',
          npnNegotiatedProtocol: 'unknown',
          requestTime: timing.requestStart / 1000,
          startLoadTime: timing.navigationStart / 1000,
          wasAlternateProtocolAvailable: false,
          wasFetchedViaSpdy: false,
          wasNpnNegotiated: false
        };
      };
    }
  `
}

/**
 * Fix permissions.query and Notification.permission
 *
 * Automation browsers can leak information through the Permissions API
 * and Notification.permission property.
 */
export function getChromePermissionsEvasion(): string {
  return `
    // Override Notification.permission to return 'default' instead of 'denied'
    const originalNotification = window.Notification;
    if (originalNotification) {
      Object.defineProperty(Notification, 'permission', {
        get: () => 'default',
        configurable: true
      });
    }

    // Override permissions.query to handle notification permission
    const originalQuery = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = function(parameters) {
      return originalQuery(parameters).then(function(result) {
        // For notifications, return a modified result
        if (parameters.name === 'notifications') {
          return Object.defineProperties(result, {
            state: { value: 'prompt', writable: false },
            onchange: { value: null, writable: true }
          });
        }
        return result;
      });
    };
  `
}

/**
 * Add realistic navigator.plugins and mimeTypes
 *
 * Headless browsers often have empty or missing plugin arrays.
 * This adds plugins that real Chrome browsers have.
 */
export function getPluginsEvasion(): string {
  return `
    // Create mock plugin data
    const mockPlugins = [
      {
        name: 'Chrome PDF Plugin',
        description: 'Portable Document Format',
        filename: 'internal-pdf-viewer',
        mimeTypes: [
          { type: 'application/x-google-chrome-pdf', suffixes: 'pdf', description: 'Portable Document Format' }
        ]
      },
      {
        name: 'Chrome PDF Viewer',
        description: '',
        filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai',
        mimeTypes: [
          { type: 'application/pdf', suffixes: 'pdf', description: '' }
        ]
      },
      {
        name: 'Native Client',
        description: '',
        filename: 'internal-nacl-plugin',
        mimeTypes: [
          { type: 'application/x-nacl', suffixes: '', description: 'Native Client Executable' },
          { type: 'application/x-pnacl', suffixes: '', description: 'Portable Native Client Executable' }
        ]
      }
    ];

    // Create PluginArray-like object
    function makePluginArray(plugins) {
      const arr = Object.create(PluginArray.prototype);
      plugins.forEach((plugin, i) => {
        const p = Object.create(Plugin.prototype);
        Object.defineProperties(p, {
          name: { value: plugin.name },
          description: { value: plugin.description },
          filename: { value: plugin.filename },
          length: { value: plugin.mimeTypes.length }
        });
        plugin.mimeTypes.forEach((mt, j) => {
          const m = Object.create(MimeType.prototype);
          Object.defineProperties(m, {
            type: { value: mt.type },
            suffixes: { value: mt.suffixes },
            description: { value: mt.description },
            enabledPlugin: { value: p }
          });
          Object.defineProperty(p, j, { value: m });
          Object.defineProperty(p, mt.type, { value: m });
        });
        Object.defineProperty(arr, i, { value: p });
        Object.defineProperty(arr, plugin.name, { value: p });
      });
      Object.defineProperty(arr, 'length', { value: plugins.length });
      arr.item = function(index) { return this[index] || null; };
      arr.namedItem = function(name) { return this[name] || null; };
      arr.refresh = function() {};
      return arr;
    }

    // Override navigator.plugins
    Object.defineProperty(navigator, 'plugins', {
      get: () => makePluginArray(mockPlugins),
      configurable: true
    });

    // Create mimeTypes from plugins
    const allMimeTypes = mockPlugins.flatMap(p => p.mimeTypes);
    function makeMimeTypeArray(mimeTypes) {
      const arr = Object.create(MimeTypeArray.prototype);
      mimeTypes.forEach((mt, i) => {
        const m = Object.create(MimeType.prototype);
        Object.defineProperties(m, {
          type: { value: mt.type },
          suffixes: { value: mt.suffixes },
          description: { value: mt.description }
        });
        Object.defineProperty(arr, i, { value: m });
        Object.defineProperty(arr, mt.type, { value: m });
      });
      Object.defineProperty(arr, 'length', { value: mimeTypes.length });
      arr.item = function(index) { return this[index] || null; };
      arr.namedItem = function(name) { return this[name] || null; };
      return arr;
    }

    Object.defineProperty(navigator, 'mimeTypes', {
      get: () => makeMimeTypeArray(allMimeTypes),
      configurable: true
    });
  `
}

/**
 * Ensure navigator.languages is properly populated
 *
 * Automation browsers may have unusual language configurations.
 */
export function getLanguagesEvasion(): string {
  return `
    // Ensure languages is an array with common values
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
      configurable: true
    });

    // Ensure language is consistent
    Object.defineProperty(navigator, 'language', {
      get: () => 'en-US',
      configurable: true
    });
  `
}

/**
 * Fix iframe contentWindow access patterns
 *
 * Headless browsers can be detected through differences in how
 * iframe contentWindow properties behave.
 */
export function getIframeContentWindowEvasion(): string {
  return `
    // Patch HTMLIFrameElement.prototype.contentWindow
    const originalContentWindowGetter = Object.getOwnPropertyDescriptor(
      HTMLIFrameElement.prototype,
      'contentWindow'
    );

    if (originalContentWindowGetter && originalContentWindowGetter.get) {
      Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
        get: function() {
          const contentWindow = originalContentWindowGetter.get.call(this);
          if (contentWindow) {
            // Ensure chrome object exists in iframe
            if (!contentWindow.chrome) {
              contentWindow.chrome = window.chrome;
            }
          }
          return contentWindow;
        },
        configurable: true
      });
    }
  `
}

/**
 * Hide WebGL vendor and renderer information
 *
 * WebGL can expose GPU vendor/renderer info that may reveal
 * virtual machine or headless environments.
 */
export function getWebglVendorEvasion(): string {
  return `
    // Override WebGL getParameter for vendor/renderer
    const getParameterProxyHandler = {
      apply: function(target, thisArg, args) {
        const param = args[0];
        const gl = thisArg;

        // UNMASKED_VENDOR_WEBGL
        if (param === 37445) {
          return 'Intel Inc.';
        }
        // UNMASKED_RENDERER_WEBGL
        if (param === 37446) {
          return 'Intel Iris OpenGL Engine';
        }

        return Reflect.apply(target, thisArg, args);
      }
    };

    // Apply to WebGLRenderingContext
    if (typeof WebGLRenderingContext !== 'undefined') {
      const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = new Proxy(
        originalGetParameter,
        getParameterProxyHandler
      );
    }

    // Apply to WebGL2RenderingContext
    if (typeof WebGL2RenderingContext !== 'undefined') {
      const originalGetParameter2 = WebGL2RenderingContext.prototype.getParameter;
      WebGL2RenderingContext.prototype.getParameter = new Proxy(
        originalGetParameter2,
        getParameterProxyHandler
      );
    }
  `
}

/**
 * Mask canvas fingerprinting
 *
 * Canvas fingerprinting is used to identify browsers. This adds
 * subtle noise to canvas operations to prevent consistent fingerprints.
 */
export function getCanvasEvasion(): string {
  return `
    // Add noise to canvas toDataURL and toBlob
    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
    const originalToBlob = HTMLCanvasElement.prototype.toBlob;

    function addNoise(canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        // Add very subtle noise (imperceptible but changes fingerprint)
        for (let i = 0; i < data.length; i += 4) {
          // Only modify every ~100th pixel and only by 1
          if (Math.random() < 0.01) {
            data[i] = Math.max(0, Math.min(255, data[i] + (Math.random() > 0.5 ? 1 : -1)));
          }
        }
        ctx.putImageData(imageData, 0, 0);
      }
    }

    HTMLCanvasElement.prototype.toDataURL = function() {
      addNoise(this);
      return originalToDataURL.apply(this, arguments);
    };

    HTMLCanvasElement.prototype.toBlob = function() {
      addNoise(this);
      return originalToBlob.apply(this, arguments);
    };
  `
}

/**
 * Fix media codec detection
 *
 * Some detection methods check supported media codecs which may
 * differ between headless and regular Chrome.
 */
export function getMediaCodecsEvasion(): string {
  return `
    // Ensure common codecs are reported as supported
    if (typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported) {
      const originalIsTypeSupported = MediaSource.isTypeSupported.bind(MediaSource);

      MediaSource.isTypeSupported = function(type) {
        // Common video codecs that should be supported
        const supportedTypes = [
          'video/mp4; codecs="avc1.42E01E"',
          'video/mp4; codecs="avc1.42E01E, mp4a.40.2"',
          'video/webm; codecs="vp8"',
          'video/webm; codecs="vp9"',
          'audio/mp4; codecs="mp4a.40.2"',
          'audio/webm; codecs="opus"',
          'audio/webm; codecs="vorbis"'
        ];

        // Return true for commonly supported types
        if (supportedTypes.some(t => type.includes(t.split(';')[0]))) {
          return true;
        }

        return originalIsTypeSupported(type);
      };
    }
  `
}

/**
 * Get all evasion scripts as an object
 *
 * @returns Object containing all evasion script generators
 */
export function getEvasionScripts(): EvasionScripts {
  return {
    webdriver: getWebdriverEvasion,
    chromeRuntime: getChromeRuntimeEvasion,
    chromePermissions: getChromePermissionsEvasion,
    plugins: getPluginsEvasion,
    languages: getLanguagesEvasion,
    iframeContentWindow: getIframeContentWindowEvasion,
    webglVendor: getWebglVendorEvasion,
    canvas: getCanvasEvasion,
    mediaCodecs: getMediaCodecsEvasion,
  }
}

/**
 * Get enabled evasion scripts based on configuration
 *
 * @param config - Resolved evasion configuration
 * @returns Array of JavaScript strings to inject
 */
export function getEnabledEvasionScripts(config: ResolvedEvasionConfig): string[] {
  const scripts: string[] = []
  const allScripts = getEvasionScripts()

  if (config.webdriver) {
    scripts.push(allScripts.webdriver())
  }
  if (config.chromeRuntime) {
    scripts.push(allScripts.chromeRuntime())
  }
  if (config.chromePermissions) {
    scripts.push(allScripts.chromePermissions())
  }
  if (config.plugins) {
    scripts.push(allScripts.plugins())
  }
  if (config.languages) {
    scripts.push(allScripts.languages())
  }
  if (config.iframeContentWindow) {
    scripts.push(allScripts.iframeContentWindow())
  }
  if (config.webglVendor) {
    scripts.push(allScripts.webglVendor())
  }
  if (config.canvas) {
    scripts.push(allScripts.canvas())
  }
  if (config.mediaCodecs) {
    scripts.push(allScripts.mediaCodecs())
  }

  return scripts
}
