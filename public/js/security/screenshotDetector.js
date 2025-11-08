/**
 * Screenshot Detector
 * Detects screenshot attempts via keyboard shortcuts and API calls
 */

class ScreenshotDetector {
  constructor(securityManager) {
    this.securityManager = securityManager;
    this.active = false;
  }
  
  start() {
    this.active = true;
    console.log('✅ Screenshot Detector: Active');
    
    // Keyboard shortcuts
    document.addEventListener('keydown', this.handleKeyDown.bind(this), true);
    document.addEventListener('keyup', this.handleKeyUp.bind(this), true);
    
    // Print Screen key
    window.addEventListener('blur', this.handleBlur.bind(this));
    
    // Clipboard API monitoring
    document.addEventListener('copy', this.handleCopy.bind(this));
    document.addEventListener('cut', this.handleCut.bind(this));
  }
  
  handleKeyDown(e) {
    if (!this.active) return;
    
    // PrintScreen key
    if (e.key === 'PrintScreen' || e.keyCode === 44) {
      e.preventDefault();
      this.reportScreenshotAttempt('printscreen_key');
      return false;
    }
    
    // Windows: Win + Shift + S (Snipping Tool)
    if (e.key === 's' && e.shiftKey && e.metaKey) {
      e.preventDefault();
      this.reportScreenshotAttempt('windows_snipping_tool');
      return false;
    }
    
    // Mac: Cmd + Shift + 3/4/5
    if (e.metaKey && e.shiftKey && ['3', '4', '5'].includes(e.key)) {
      e.preventDefault();
      this.reportScreenshotAttempt('mac_screenshot');
      return false;
    }
    
    // Linux: various screenshot tools
    if (e.key === 'Print' || (e.shiftKey && e.key === 'Print')) {
      e.preventDefault();
      this.reportScreenshotAttempt('linux_screenshot');
      return false;
    }
  }
  
  handleKeyUp(e) {
    if (!this.active) return;
    
    // Some screenshot tools trigger on key up
    if (e.key === 'PrintScreen' || e.keyCode === 44) {
      e.preventDefault();
      return false;
    }
  }
  
  handleBlur() {
    // PrintScreen often causes blur without other events
    // This is a heuristic detection
    if (this.active && document.hasFocus() === false) {
      setTimeout(() => {
        if (document.hasFocus() === false) {
          // Possible screenshot attempt
          console.warn('Possible screenshot attempt detected via blur');
        }
      }, 100);
    }
  }
  
  handleCopy(e) {
    // Prevent copying (handled by CopyPasteDetector but we also log it)
    if (this.active) {
      e.preventDefault();
      return false;
    }
  }
  
  handleCut(e) {
    if (this.active) {
      e.preventDefault();
      return false;
    }
  }
  
  async reportScreenshotAttempt(method) {
    console.warn('🚨 Screenshot attempt detected:', method);
    
    // Take evidence photo from camera if available
    let cameraSnapshot = null;
    if (window.cameraMonitor && window.cameraMonitor.isActive()) {
      cameraSnapshot = await window.cameraMonitor.captureFrame();
    }
    
    await this.securityManager.reportViolation('screenshot_attempt', {
      method,
      timestamp: new Date().toISOString(),
      cameraSnapshot
    }, 'high');
  }
  
  stop() {
    this.active = false;
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
    document.removeEventListener('copy', this.handleCopy);
    document.removeEventListener('cut', this.handleCut);
  }
}

window.ScreenshotDetector = ScreenshotDetector;
