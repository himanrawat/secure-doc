/**
 * Extension Detector
 * Detects browser extensions that might compromise security
 */

class ExtensionDetector {
  constructor(securityManager) {
    this.securityManager = securityManager;
    this.active = false;
    this.detectedExtensions = [];
  }
  
  start() {
    this.active = true;
    console.log('✅ Extension Detector: Active');
    
    // Check for common extension artifacts
    this.checkForExtensions();
  }
  
  async checkForExtensions() {
    if (!this.active) return;
    
    // Method 1: Check for extension-injected elements
    const suspiciousElements = [
      '[data-extension]',
      '[data-chrome-extension]',
      '[data-firefox-addon]',
      '[class*="extension"]',
      '[id*="extension"]'
    ];
    
    suspiciousElements.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        console.warn('Extension-injected elements detected:', selector);
        this.detectedExtensions.push({
          type: 'injected_element',
          selector,
          count: elements.length
        });
      }
    });
    
    // Method 2: Check for modified global objects
    const originalFetch = fetch;
    if (window.fetch !== originalFetch) {
      console.warn('Fetch API has been modified');
      this.detectedExtensions.push({
        type: 'modified_fetch'
      });
    }
    
    // Method 3: Check for content scripts
    if (document.documentElement.hasAttribute('data-extension')) {
      console.warn('Content script detected');
      this.detectedExtensions.push({
        type: 'content_script',
        extension: document.documentElement.getAttribute('data-extension')
      });
    }
    
    // Method 4: Resource timing check (extensions load resources)
    if (window.performance && window.performance.getEntriesByType) {
      const resources = performance.getEntriesByType('resource');
      const extensionResources = resources.filter(r => 
        r.name.includes('chrome-extension://') || 
        r.name.includes('moz-extension://')
      );
      
      if (extensionResources.length > 0) {
        console.warn('Extension resources detected:', extensionResources.length);
        this.detectedExtensions.push({
          type: 'extension_resources',
          count: extensionResources.length
        });
      }
    }
    
    // Report if extensions detected
    if (this.detectedExtensions.length > 0) {
      await this.reportExtensions();
    }
  }
  
  async reportExtensions() {
    console.warn('🚨 Browser extensions detected:', this.detectedExtensions);
    
    await this.securityManager.reportViolation('browser_extensions_detected', {
      extensions: this.detectedExtensions,
      timestamp: new Date().toISOString()
    }, 'high');
  }
  
  stop() {
    this.active = false;
  }
}

window.ExtensionDetector = ExtensionDetector;
