/**
 * Focus Loss Detector
 * Detects when user switches tabs or loses window focus
 */

class FocusLossDetector {
  constructor(securityManager) {
    this.securityManager = securityManager;
    this.active = false;
    this.focusLost = false;
    this.blurTimeout = null;
  }
  
  start() {
    this.active = true;
    console.log('✅ Focus Loss Detector: Active');
    
    // Visibility change (tab switch)
    document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    
    // Window blur/focus
    window.addEventListener('blur', this.handleBlur.bind(this));
    window.addEventListener('focus', this.handleFocus.bind(this));
    
    // Page hide (navigation away)
    window.addEventListener('pagehide', this.handlePageHide.bind(this));
    window.addEventListener('pageshow', this.handlePageShow.bind(this));
  }
  
  handleVisibilityChange() {
    if (!this.active) return;
    
    if (document.hidden) {
      this.onFocusLost('tab_switch');
    } else {
      this.onFocusGained();
    }
  }
  
  handleBlur() {
    if (!this.active) return;
    
    // Slight delay to avoid false positives
    this.blurTimeout = setTimeout(() => {
      this.onFocusLost('window_blur');
    }, 100);
  }
  
  handleFocus() {
    if (!this.active) return;
    
    if (this.blurTimeout) {
      clearTimeout(this.blurTimeout);
    }
    
    this.onFocusGained();
  }
  
  handlePageHide() {
    if (!this.active) return;
    this.onFocusLost('page_hide');
  }
  
  handlePageShow() {
    if (!this.active) return;
    this.onFocusGained();
  }
  
  async onFocusLost(reason) {
    if (this.focusLost) return;
    
    console.warn('⚠️ Focus lost:', reason);
    this.focusLost = true;
    
    // Apply blur effect
    this.securityManager.blur();
    
    // Show black overlay for alt-tab
    if (reason === 'window_blur' || reason === 'tab_switch') {
      this.securityManager.showBlackOverlay();
    }
    
    // Report violation
    await this.securityManager.reportViolation('focus_lost', {
      reason,
      timestamp: new Date().toISOString()
    }, 'medium');
    
    // Log activity
    if (window.socket) {
      window.socket.emit('activity', {
        action: 'focus_lost',
        sessionId: this.securityManager.config.sessionId,
        metadata: { reason }
      });
    }
  }
  
  async onFocusGained() {
    if (!this.focusLost) return;
    
    console.log('✅ Focus regained');
    this.focusLost = false;
    
    // Remove blur and black overlay
    this.securityManager.unblur();
    this.securityManager.hideBlackOverlay();
    
    // Log activity
    if (window.socket) {
      window.socket.emit('activity', {
        action: 'focus_gained',
        sessionId: this.securityManager.config.sessionId
      });
    }
  }
  
  stop() {
    this.active = false;
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('blur', this.handleBlur);
    window.removeEventListener('focus', this.handleFocus);
    window.removeEventListener('pagehide', this.handlePageHide);
    window.removeEventListener('pageshow', this.handlePageShow);
    
    if (this.blurTimeout) {
      clearTimeout(this.blurTimeout);
    }
  }
}

window.FocusLossDetector = FocusLossDetector;
