/**
 * Multi-Monitor Detector
 * Detects and blocks multiple monitor usage
 */

class MultiMonitorDetector {
  constructor(securityManager) {
    this.securityManager = securityManager;
    this.active = false;
    this.checkInterval = null;
    this.initialScreenSetup = null;
  }
  
  start() {
    this.active = true;
    console.log('✅ Multi-Monitor Detector: Active');
    
    // Capture initial screen setup
    this.captureScreenSetup();
    
    // Check periodically
    this.checkInterval = setInterval(() => this.checkScreens(), 2000);
    
    // Monitor window resize/move
    window.addEventListener('resize', this.handleWindowChange.bind(this));
    
    // Monitor fullscreen changes
    document.addEventListener('fullscreenchange', this.handleFullscreenChange.bind(this));
  }
  
  async captureScreenSetup() {
    try {
      if (window.screen) {
        this.initialScreenSetup = {
          width: window.screen.width,
          height: window.screen.height,
          availWidth: window.screen.availWidth,
          availHeight: window.screen.availHeight,
          colorDepth: window.screen.colorDepth,
          pixelDepth: window.screen.pixelDepth
        };
      }
      
      // Check if Screen Detection API is available (experimental)
      if ('getScreenDetails' in window) {
        const screenDetails = await window.getScreenDetails();
        if (screenDetails.screens.length > 1) {
          console.warn('🚨 Multiple monitors detected!');
          await this.reportMultipleMonitors(screenDetails.screens.length);
        }
      }
    } catch (error) {
      console.warn('Screen detection API not available:', error);
    }
  }
  
  async checkScreens() {
    if (!this.active) return;
    
    try {
      // Method 1: Window position detection
      // If window is moved to negative coordinates, it might be on another monitor
      if (window.screenX < 0 || window.screenY < 0) {
        console.warn('Window on extended display detected');
        await this.reportMultipleMonitors(2);
      }
      
      // Method 2: Window size vs screen size
      // If window is larger than screen, it might span multiple monitors
      if (window.outerWidth > window.screen.width || 
          window.outerHeight > window.screen.height) {
        console.warn('Window spanning multiple displays');
        await this.reportMultipleMonitors(2);
      }
      
      // Method 3: Screen position changes
      if (this.initialScreenSetup) {
        const currentWidth = window.screen.width;
        const currentHeight = window.screen.height;
        
        // Significant change in screen dimensions might indicate monitor switch
        if (Math.abs(currentWidth - this.initialScreenSetup.width) > 100 ||
            Math.abs(currentHeight - this.initialScreenSetup.height) > 100) {
          console.warn('Screen configuration changed');
          await this.reportMultipleMonitors(2);
        }
      }
    } catch (error) {
      console.error('Multi-monitor check error:', error);
    }
  }
  
  async handleWindowChange() {
    if (!this.active) return;
    
    // Check if window moved to another monitor
    await this.checkScreens();
  }
  
  async handleFullscreenChange() {
    if (!this.active) return;
    
    // Fullscreen on secondary monitor detection
    if (document.fullscreenElement) {
      await this.checkScreens();
    }
  }
  
  async reportMultipleMonitors(count) {
    console.warn('🚨 Multiple monitors detected:', count);
    
    // Capture evidence
    let cameraSnapshot = null;
    if (window.cameraMonitor && window.cameraMonitor.isActive()) {
      cameraSnapshot = await window.cameraMonitor.captureFrame();
    }
    
    await this.securityManager.reportViolation('multiple_monitors', {
      monitorCount: count,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      windowX: window.screenX,
      windowY: window.screenY,
      timestamp: new Date().toISOString(),
      cameraSnapshot
    }, 'high');
    
    // Optionally terminate session
    // this.securityManager.handleSessionTermination({
    //   reason: 'Multiple monitors detected'
    // });
  }
  
  stop() {
    this.active = false;
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    window.removeEventListener('resize', this.handleWindowChange);
    document.removeEventListener('fullscreenchange', this.handleFullscreenChange);
  }
}

window.MultiMonitorDetector = MultiMonitorDetector;
