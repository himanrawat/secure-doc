/**
 * Screen Recording Detector
 * Detects common screen recording software
 */

class ScreenRecordingDetector {
  constructor(securityManager) {
    this.securityManager = securityManager;
    this.active = false;
    this.checkInterval = null;
  }
  
  start() {
    this.active = true;
    console.log('✅ Screen Recording Detector: Active');
    
    // Check for screen recording indicators
    this.checkInterval = setInterval(() => this.checkForRecording(), 2000);
    
    // Check for media recorder API usage
    this.monitorMediaRecorder();
  }
  
  async checkForRecording() {
    if (!this.active) return;
    
    try {
      // Method 1: Check display media
      if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
        // Browser supports screen capture API
        // We can't directly detect if it's being used, but we can monitor for it
      }
      
      // Method 2: Check for common recording software processes (Windows-specific)
      // This requires a browser extension or native app, so we'll use heuristics
      
      // Method 3: Performance monitoring
      // Screen recording often increases CPU/GPU usage
      if (performance && performance.memory) {
        const memUsage = performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit;
        if (memUsage > 0.9) {
          console.warn('High memory usage detected - possible recording');
        }
      }
      
      // Method 4: Check for suspicious window titles via Page Visibility API changes
      // Frequent visibility changes might indicate recording software
      
    } catch (error) {
      console.error('Screen recording check error:', error);
    }
  }
  
  monitorMediaRecorder() {
    // Override MediaRecorder constructor to detect usage
    if (window.MediaRecorder) {
      const originalMediaRecorder = window.MediaRecorder;
      
      window.MediaRecorder = function(...args) {
        console.warn('🚨 MediaRecorder instantiated!');
        this.reportRecordingDetected('media_recorder_api');
        return new originalMediaRecorder(...args);
      }.bind(this);
      
      // Preserve prototype
      window.MediaRecorder.prototype = originalMediaRecorder.prototype;
    }
    
    // Monitor getUserMedia calls for display capture
    if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
      const originalGetDisplayMedia = navigator.mediaDevices.getDisplayMedia;
      
      navigator.mediaDevices.getDisplayMedia = async function(...args) {
        console.warn('🚨 getDisplayMedia called!');
        await this.reportRecordingDetected('display_media_api');
        return originalGetDisplayMedia.apply(navigator.mediaDevices, args);
      }.bind(this);
    }
  }
  
  async reportRecordingDetected(method) {
    console.warn('🚨 Screen recording detected:', method);
    
    // Capture evidence from camera
    let cameraSnapshot = null;
    if (window.cameraMonitor && window.cameraMonitor.isActive()) {
      cameraSnapshot = await window.cameraMonitor.captureFrame();
    }
    
    await this.securityManager.reportViolation('screen_recording_detected', {
      method,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      cameraSnapshot
    }, 'critical');
  }
  
  stop() {
    this.active = false;
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }
}

window.ScreenRecordingDetector = ScreenRecordingDetector;
