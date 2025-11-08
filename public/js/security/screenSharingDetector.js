/**
 * Screen Sharing Detector
 * Detects when screen sharing applications are active
 */

class ScreenSharingDetector {
  constructor(securityManager) {
    this.securityManager = securityManager;
    this.active = false;
    this.checkInterval = null;
  }
  
  start() {
    this.active = true;
    console.log('✅ Screen Sharing Detector: Active');
    
    // Periodic checks
    this.checkInterval = setInterval(() => this.checkForScreenSharing(), 3000);
    
    // Monitor getUserMedia for display capture
    this.monitorDisplayCapture();
  }
  
  async checkForScreenSharing() {
    if (!this.active) return;
    
    try {
      // Check if display media is being captured
      // This is limited by browser security, so we use heuristics
      
      // Method 1: Check for suspicious window titles in document.title changes
      // Screen sharing apps often change window titles
      
      // Method 2: Monitor performance
      // Screen sharing increases CPU usage
      if (performance && performance.memory) {
        const memUsage = performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit;
        if (memUsage > 0.85) {
          // High usage detected
          console.warn('High resource usage - possible screen sharing');
        }
      }
      
      // Method 3: Check for WebRTC connections
      // Screen sharing often uses WebRTC
      if (this.detectWebRTCConnections()) {
        console.warn('WebRTC connections detected - possible screen sharing');
        await this.reportScreenSharing('webrtc_connection');
      }
      
    } catch (error) {
      console.error('Screen sharing check error:', error);
    }
  }
  
  detectWebRTCConnections() {
    // Check if RTCPeerConnection is being used
    if (window.RTCPeerConnection) {
      // We can't directly access existing connections without modifications
      // But we can monitor for new ones
      return false;
    }
    return false;
  }
  
  monitorDisplayCapture() {
    // Override getDisplayMedia
    if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
      const originalGetDisplayMedia = navigator.mediaDevices.getDisplayMedia;
      
      navigator.mediaDevices.getDisplayMedia = async function(...args) {
        console.warn('🚨 Display capture requested!');
        await this.reportScreenSharing('display_media_api');
        
        // Block the call
        throw new Error('Screen sharing is not allowed for this document');
      }.bind(this);
    }
    
    // Monitor RTCPeerConnection for screen sharing
    if (window.RTCPeerConnection) {
      const originalRTCPeerConnection = window.RTCPeerConnection;
      
      window.RTCPeerConnection = function(...args) {
        console.warn('🚨 RTCPeerConnection created!');
        
        const pc = new originalRTCPeerConnection(...args);
        
        // Monitor addTrack for display capture
        const originalAddTrack = pc.addTrack;
        pc.addTrack = function(track, ...streams) {
          if (track.kind === 'video' && track.label.includes('screen')) {
            console.warn('🚨 Screen track added to RTCPeerConnection!');
            this.reportScreenSharing('rtc_screen_track');
          }
          return originalAddTrack.call(pc, track, ...streams);
        }.bind(this);
        
        return pc;
      }.bind(this);
      
      // Preserve prototype
      window.RTCPeerConnection.prototype = originalRTCPeerConnection.prototype;
    }
  }
  
  async reportScreenSharing(method) {
    console.warn('🚨 Screen sharing detected:', method);
    
    // Capture evidence
    let cameraSnapshot = null;
    if (window.cameraMonitor && window.cameraMonitor.isActive()) {
      cameraSnapshot = await window.cameraMonitor.captureFrame();
    }
    
    await this.securityManager.reportViolation('screen_sharing_detected', {
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

window.ScreenSharingDetector = ScreenSharingDetector;
