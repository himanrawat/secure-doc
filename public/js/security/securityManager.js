/**
 * Security Manager - Main security orchestrator
 * Coordinates all security measures and monitors for violations
 */

class SecurityManager {
  constructor(config = {}) {
    this.config = {
      sessionId: config.sessionId,
      documentId: config.documentId,
      securityLevel: config.securityLevel || 'MEDIUM',
      maxViolations: config.maxViolations || 3,
      ...config
    };
    
    this.violations = [];
    this.isBlurred = false;
    this.detectors = [];
    this.heartbeatInterval = null;
    
    this.init();
  }
  
  init() {
    console.log('🔒 Initializing Security Manager...');
    console.log('Security Level:', this.config.securityLevel);
    
    // Initialize all detectors based on security level
    this.initDetectors();
    
    // Start heartbeat
    this.startHeartbeat();
    
    // Listen for session termination
    if (window.socket) {
      window.socket.on('session-terminated', (data) => {
        this.handleSessionTermination(data);
      });
      
      window.socket.on('document-revoked', (data) => {
        this.handleDocumentRevoked(data);
      });
    }
  }
  
  initDetectors() {
    const { securityLevel } = this.config;
    
    // Basic protections (all levels)
    this.detectors.push(new ScreenshotDetector(this));
    this.detectors.push(new CopyPasteDetector(this));
    this.detectors.push(new PrintDetector(this));
    this.detectors.push(new ContextMenuDetector(this));
    this.detectors.push(new FocusLossDetector(this));
    
    // Medium and above
    if (['MEDIUM', 'HIGH', 'MAXIMUM'].includes(securityLevel)) {
      this.detectors.push(new DevToolsDetector(this));
      this.detectors.push(new ScreenRecordingDetector(this));
    }
    
    // High and above
    if (['HIGH', 'MAXIMUM'].includes(securityLevel)) {
      this.detectors.push(new ScreenSharingDetector(this));
      this.detectors.push(new MultiMonitorDetector(this));
      this.detectors.push(new TabSwitchDetector(this));
    }
    
    // Maximum only
    if (securityLevel === 'MAXIMUM') {
      this.detectors.push(new DOMIntegrityDetector(this));
      this.detectors.push(new ExtensionDetector(this));
    }
    
    // Start all detectors
    this.detectors.forEach(detector => detector.start());
  }
  
  async reportViolation(type, evidence = {}, severity = 'medium') {
    console.warn('🚨 VIOLATION DETECTED:', type);
    
    this.violations.push({
      type,
      timestamp: new Date(),
      severity,
      evidence
    });
    
    // Send to server
    try {
      const response = await fetch('/api/monitoring/violation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          sessionId: this.config.sessionId,
          violationType: type,
          evidence,
          severity
        })
      });
      
      const data = await response.json();
      
      if (data.sessionTerminated) {
        this.handleSessionTermination({ reason: 'Maximum violations reached' });
      } else if (data.remainingViolations !== undefined) {
        this.showViolationWarning(type, data.remainingViolations);
      }
    } catch (error) {
      console.error('Error reporting violation:', error);
    }
    
    // Emit via socket
    if (window.socket) {
      window.socket.emit('violation', {
        sessionId: this.config.sessionId,
        violationType: type,
        evidence,
        severity
      });
    }
  }
  
  showViolationWarning(type, remainingViolations) {
    const warning = document.createElement('div');
    warning.className = 'violation-warning';
    warning.innerHTML = `
      <div class="violation-content">
        <h3>⚠️ Security Violation Detected</h3>
        <p><strong>Type:</strong> ${type.replace(/_/g, ' ').toUpperCase()}</p>
        <p><strong>Remaining Violations:</strong> ${remainingViolations}</p>
        <p>Your session will be terminated if you continue violating security policies.</p>
      </div>
    `;
    
    document.body.appendChild(warning);
    
    setTimeout(() => {
      warning.classList.add('show');
    }, 100);
    
    setTimeout(() => {
      warning.classList.remove('show');
      setTimeout(() => warning.remove(), 300);
    }, 5000);
  }
  
  handleSessionTermination(data) {
    console.error('🔴 SESSION TERMINATED:', data.reason);
    
    // Stop all detectors
    this.detectors.forEach(detector => detector.stop && detector.stop());
    
    // Clear heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    // Show termination screen
    document.body.innerHTML = `
      <div class="session-terminated">
        <div class="termination-content">
          <h1>🔒 Session Terminated</h1>
          <p>${data.reason || 'Your viewing session has been terminated.'}</p>
          <p>This document is no longer accessible.</p>
          <button onclick="window.location.href='/'">Return to Home</button>
        </div>
      </div>
    `;
  }
  
  handleDocumentRevoked(data) {
    console.error('🔴 DOCUMENT REVOKED:', data.message);
    this.handleSessionTermination({ reason: data.message });
  }
  
  blur() {
    if (!this.isBlurred) {
      document.body.classList.add('security-blur');
      const overlay = document.createElement('div');
      overlay.id = 'security-overlay';
      overlay.innerHTML = '<div class="overlay-text">⚠️ FOCUS REQUIRED</div>';
      document.body.appendChild(overlay);
      this.isBlurred = true;
    }
  }
  
  unblur() {
    if (this.isBlurred) {
      document.body.classList.remove('security-blur');
      const overlay = document.getElementById('security-overlay');
      if (overlay) overlay.remove();
      this.isBlurred = false;
    }
  }
  
  showBlackOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'black-overlay';
    overlay.className = 'black-overlay';
    document.body.appendChild(overlay);
    
    setTimeout(() => {
      overlay.style.opacity = '1';
    }, 10);
  }
  
  hideBlackOverlay() {
    const overlay = document.getElementById('black-overlay');
    if (overlay) {
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 300);
    }
  }
  
  startHeartbeat() {
    const interval = 5000; // 5 seconds
    
    this.heartbeatInterval = setInterval(async () => {
      try {
        await fetch('/api/monitoring/heartbeat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            sessionId: this.config.sessionId,
            currentPage: window.currentPage || 1,
            scrollDepth: this.getScrollDepth(),
            attentionScore: window.attentionScore || 100
          })
        });
        
        // Also send via socket
        if (window.socket) {
          window.socket.emit('heartbeat', {
            sessionId: this.config.sessionId,
            timestamp: new Date(),
            violations: this.violations.length
          });
        }
      } catch (error) {
        console.error('Heartbeat error:', error);
      }
    }, interval);
  }
  
  getScrollDepth() {
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    return Math.round(((scrollTop + windowHeight) / documentHeight) * 100);
  }
  
  destroy() {
    console.log('🔓 Destroying Security Manager...');
    
    // Stop all detectors
    this.detectors.forEach(detector => detector.stop && detector.stop());
    
    // Clear heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
  }
}

// Export for use in other modules
window.SecurityManager = SecurityManager;
