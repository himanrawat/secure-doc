/**
 * Device Fingerprinting
 * Generate unique browser/device fingerprint for access control
 */

class DeviceFingerprint {
  constructor() {
    this.fingerprint = null;
  }
  
  async generate() {
    console.log('🔍 Generating device fingerprint...');
    
    const components = await this.collectComponents();
    const hash = await this.hashComponents(components);
    
    this.fingerprint = {
      hash,
      components,
      timestamp: new Date().toISOString()
    };
    
    return this.fingerprint;
  }
  
  async collectComponents() {
    const components = {};
    
    // Screen information
    components.screen = {
      width: window.screen.width,
      height: window.screen.height,
      availWidth: window.screen.availWidth,
      availHeight: window.screen.availHeight,
      colorDepth: window.screen.colorDepth,
      pixelDepth: window.screen.pixelDepth,
      orientation: window.screen.orientation?.type
    };
    
    // Timezone
    components.timezone = {
      offset: new Date().getTimezoneOffset(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };
    
    // Language
    components.language = {
      language: navigator.language,
      languages: navigator.languages
    };
    
    // Platform
    components.platform = {
      platform: navigator.platform,
      userAgent: navigator.userAgent,
      vendor: navigator.vendor,
      hardwareConcurrency: navigator.hardwareConcurrency
    };
    
    // Canvas fingerprint
    components.canvas = await this.getCanvasFingerprint();
    
    // WebGL fingerprint
    components.webgl = await this.getWebGLFingerprint();
    
    // Audio fingerprint
    components.audio = await this.getAudioFingerprint();
    
    // Fonts
    components.fonts = await this.detectFonts();
    
    // Plugins (deprecated but still useful)
    components.plugins = this.getPlugins();
    
    // Storage
    components.storage = {
      localStorage: typeof window.localStorage !== 'undefined',
      sessionStorage: typeof window.sessionStorage !== 'undefined',
      indexedDB: typeof window.indexedDB !== 'undefined'
    };
    
    // Media devices
    components.mediaDevices = await this.getMediaDevices();
    
    return components;
  }
  
  async getCanvasFingerprint() {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 50;
      
      const ctx = canvas.getContext('2d');
      
      // Draw text
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);
      
      ctx.fillStyle = '#069';
      ctx.fillText('Fingerprint 🔒', 2, 15);
      
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
      ctx.fillText('Fingerprint 🔒', 4, 17);
      
      // Get data
      const dataURL = canvas.toDataURL();
      
      // Hash the data URL
      const hash = await this.simpleHash(dataURL);
      
      return hash;
    } catch (err) {
      console.error('Canvas fingerprint error:', err);
      return 'unavailable';
    }
  }
  
  async getWebGLFingerprint() {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      
      if (!gl) return 'unavailable';
      
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      
      const fingerprint = {
        vendor: gl.getParameter(gl.VENDOR),
        renderer: gl.getParameter(gl.RENDERER),
        version: gl.getParameter(gl.VERSION),
        shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION)
      };
      
      if (debugInfo) {
        fingerprint.unmaskedVendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
        fingerprint.unmaskedRenderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      }
      
      return JSON.stringify(fingerprint);
    } catch (err) {
      console.error('WebGL fingerprint error:', err);
      return 'unavailable';
    }
  }
  
  async getAudioFingerprint() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return 'unavailable';
      
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const analyser = context.createAnalyser();
      const gainNode = context.createGain();
      const scriptProcessor = context.createScriptProcessor(4096, 1, 1);
      
      gainNode.gain.value = 0; // Mute
      oscillator.type = 'triangle';
      oscillator.connect(analyser);
      analyser.connect(scriptProcessor);
      scriptProcessor.connect(gainNode);
      gainNode.connect(context.destination);
      
      oscillator.start(0);
      
      return new Promise((resolve) => {
        scriptProcessor.addEventListener('audioprocess', (event) => {
          const output = event.outputBuffer.getChannelData(0);
          const hash = output.slice(0, 30).reduce((a, b) => a + Math.abs(b), 0);
          
          oscillator.stop();
          context.close();
          
          resolve(hash.toString());
        }, { once: true });
        
        // Timeout
        setTimeout(() => {
          oscillator.stop();
          context.close();
          resolve('timeout');
        }, 1000);
      });
    } catch (err) {
      console.error('Audio fingerprint error:', err);
      return 'unavailable';
    }
  }
  
  async detectFonts() {
    const baseFonts = ['monospace', 'sans-serif', 'serif'];
    const testFonts = [
      'Arial', 'Verdana', 'Times New Roman', 'Courier New', 'Georgia',
      'Palatino', 'Garamond', 'Bookman', 'Comic Sans MS', 'Trebuchet MS',
      'Impact', 'Lucida Console', 'Tahoma', 'Lucida Sans Unicode'
    ];
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    const testString = 'mmmmmmmmmmlli';
    const testSize = '72px';
    
    const baselines = {};
    
    // Measure base fonts
    for (const baseFont of baseFonts) {
      ctx.font = `${testSize} ${baseFont}`;
      baselines[baseFont] = ctx.measureText(testString).width;
    }
    
    // Test fonts
    const detectedFonts = [];
    
    for (const testFont of testFonts) {
      let detected = false;
      
      for (const baseFont of baseFonts) {
        ctx.font = `${testSize} '${testFont}', ${baseFont}`;
        const width = ctx.measureText(testString).width;
        
        if (width !== baselines[baseFont]) {
          detected = true;
          break;
        }
      }
      
      if (detected) {
        detectedFonts.push(testFont);
      }
    }
    
    return detectedFonts;
  }
  
  getPlugins() {
    const plugins = [];
    
    for (let i = 0; i < navigator.plugins.length; i++) {
      const plugin = navigator.plugins[i];
      plugins.push({
        name: plugin.name,
        description: plugin.description,
        filename: plugin.filename
      });
    }
    
    return plugins;
  }
  
  async getMediaDevices() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        return 'unavailable';
      }
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      return devices.map(device => ({
        kind: device.kind,
        label: device.label ? 'available' : 'blocked', // Don't leak actual label
        deviceId: device.deviceId ? 'available' : 'blocked'
      }));
    } catch (err) {
      console.error('Media devices error:', err);
      return 'unavailable';
    }
  }
  
  async hashComponents(components) {
    const str = JSON.stringify(components);
    return await this.simpleHash(str);
  }
  
  async simpleHash(str) {
    // Use Web Crypto API if available
    if (window.crypto && window.crypto.subtle) {
      try {
        const encoder = new TextEncoder();
        const data = encoder.encode(str);
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      } catch (err) {
        console.error('Crypto hash error:', err);
      }
    }
    
    // Fallback to simple hash
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }
  
  getFingerprint() {
    return this.fingerprint;
  }
  
  getFingerprintHash() {
    return this.fingerprint?.hash;
  }
}

window.DeviceFingerprint = DeviceFingerprint;
