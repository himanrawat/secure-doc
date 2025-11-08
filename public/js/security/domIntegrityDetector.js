/**
 * DOM Integrity Detector
 * Monitors for tampering with page DOM and security elements
 */

class DOMIntegrityDetector {
  constructor(securityManager) {
    this.securityManager = securityManager;
    this.active = false;
    this.observer = null;
    this.criticalElements = new Set();
    this.checkInterval = null;
  }
  
  start() {
    this.active = true;
    console.log('✅ DOM Integrity Detector: Active');
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.initialize());
    } else {
      this.initialize();
    }
  }
  
  initialize() {
    // Identify critical elements
    this.identifyCriticalElements();
    
    // Set up mutation observer
    this.setupMutationObserver();
    
    // Periodic integrity checks
    this.checkInterval = setInterval(() => this.performIntegrityCheck(), 5000);
  }
  
  identifyCriticalElements() {
    // Mark critical security elements
    const watermark = document.getElementById('watermark-overlay');
    const securityStatus = document.getElementById('security-status');
    const cameraFeed = document.getElementById('camera-feed');
    
    if (watermark) this.criticalElements.add(watermark);
    if (securityStatus) this.criticalElements.add(securityStatus);
    if (cameraFeed) this.criticalElements.add(cameraFeed);
  }
  
  setupMutationObserver() {
    this.observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (!this.active) return;
        
        // Check if critical elements were removed
        if (mutation.type === 'childList') {
          mutation.removedNodes.forEach((node) => {
            if (this.criticalElements.has(node)) {
              console.error('🚨 Critical element removed:', node.id);
              this.reportTampering('critical_element_removed', node.id);
            }
          });
        }
        
        // Check if critical elements were modified
        if (mutation.type === 'attributes') {
          if (this.criticalElements.has(mutation.target)) {
            console.warn('⚠️ Critical element modified:', mutation.target.id, mutation.attributeName);
            
            // Check for display:none or visibility:hidden
            const style = window.getComputedStyle(mutation.target);
            if (style.display === 'none' || style.visibility === 'hidden') {
              this.reportTampering('critical_element_hidden', mutation.target.id);
            }
          }
        }
      });
    });
    
    // Observe entire document
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    });
  }
  
  performIntegrityCheck() {
    if (!this.active) return;
    
    // Check if critical elements still exist and are visible
    this.criticalElements.forEach((element) => {
      if (!document.body.contains(element)) {
        console.error('🚨 Critical element missing:', element.id);
        this.reportTampering('critical_element_missing', element.id);
      } else {
        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
          console.warn('⚠️ Critical element hidden:', element.id);
          this.reportTampering('critical_element_hidden', element.id);
        }
      }
    });
    
    // Check for suspicious scripts
    const scripts = document.querySelectorAll('script');
    scripts.forEach((script) => {
      if (!script.dataset.verified) {
        console.warn('⚠️ Unverified script detected:', script.src || 'inline');
      }
    });
    
    // Check for browser extensions modifying page
    if (document.documentElement.hasAttribute('data-extension')) {
      console.warn('⚠️ Browser extension detected');
      this.reportTampering('browser_extension_detected', document.documentElement.getAttribute('data-extension'));
    }
  }
  
  async reportTampering(type, details) {
    console.error('🚨 DOM Tampering detected:', type, details);
    
    await this.securityManager.reportViolation('dom_tampering', {
      type,
      details,
      timestamp: new Date().toISOString()
    }, 'critical');
    
    // Terminate session for critical tampering
    setTimeout(() => {
      this.securityManager.handleSessionTermination({
        reason: 'DOM tampering detected - Security violation'
      });
    }, 2000);
  }
  
  stop() {
    this.active = false;
    if (this.observer) {
      this.observer.disconnect();
    }
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }
}

window.DOMIntegrityDetector = DOMIntegrityDetector;
