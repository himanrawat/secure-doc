/**
 * DevTools Detector
 * Detects when browser developer tools are opened
 */

class DevToolsDetector {
  constructor(securityManager) {
    this.securityManager = securityManager;
    this.active = false;
    this.threshold = 160;
    this.checkInterval = null;
    this.devtoolsOpen = false;
  }
  
  start() {
    this.active = true;
    console.log('✅ DevTools Detector: Active');
    
    // Method 1: Size detection
    this.checkInterval = setInterval(() => this.checkDevTools(), 1000);
    
    // Method 2: Console detection
    this.setupConsoleDetection();
    
    // Method 3: Debugger detection
    this.setupDebuggerDetection();
    
    // Method 4: toString override detection
    this.setupToStringDetection();
  }
  
  checkDevTools() {
    if (!this.active) return;
    
    const widthThreshold = window.outerWidth - window.innerWidth > this.threshold;
    const heightThreshold = window.outerHeight - window.innerHeight > this.threshold;
    
    // Firebug detection
    const isFirebug = window.console && (window.console.firebug || window.console.exception);
    
    if (widthThreshold || heightThreshold || isFirebug) {
      if (!this.devtoolsOpen) {
        this.devtoolsOpen = true;
        this.reportDevToolsOpen();
      }
    } else {
      this.devtoolsOpen = false;
    }
  }
  
  setupConsoleDetection() {
    // Detect console.log usage
    const originalLog = console.log;
    console.log = function(...args) {
      if (this.active && !this.devtoolsOpen) {
        this.reportDevToolsOpen();
      }
      originalLog.apply(console, args);
    }.bind(this);
  }
  
  setupDebuggerDetection() {
    // Detect debugger statements
    setInterval(() => {
      const start = performance.now();
      debugger; // This will pause if devtools is open
      const end = performance.now();
      
      if (end - start > 100) {
        if (!this.devtoolsOpen) {
          this.devtoolsOpen = true;
          this.reportDevToolsOpen();
        }
      }
    }, 1000);
  }
  
  setupToStringDetection() {
    // Create element that triggers toString when inspected
    const element = new Image();
    Object.defineProperty(element, 'id', {
      get: () => {
        if (this.active && !this.devtoolsOpen) {
          this.devtoolsOpen = true;
          this.reportDevToolsOpen();
        }
        return 'devtools-detector';
      }
    });
    
    // Trigger by logging
    setInterval(() => {
      console.log(element);
      console.clear();
    }, 2000);
  }
  
  async reportDevToolsOpen() {
    console.warn('🚨 Developer Tools detected!');
    
    await this.securityManager.reportViolation('devtools_opened', {
      timestamp: new Date().toISOString(),
      windowSize: {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        outerWidth: window.outerWidth,
        outerHeight: window.outerHeight
      }
    }, 'critical');
    
    // Auto-close session after 3 seconds
    setTimeout(() => {
      this.securityManager.handleSessionTermination({
        reason: 'Developer tools detected - Session terminated for security'
      });
    }, 3000);
  }
  
  stop() {
    this.active = false;
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }
}

window.DevToolsDetector = DevToolsDetector;
