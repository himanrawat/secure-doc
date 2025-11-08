/**
 * Tab Switch Detector
 * Enhanced focus loss detection specific to tab switching
 */

class TabSwitchDetector {
  constructor(securityManager) {
    this.securityManager = securityManager;
    this.active = false;
    this.tabSwitchCount = 0;
    this.lastSwitchTime = null;
  }
  
  start() {
    this.active = true;
    console.log('✅ Tab Switch Detector: Active');
    
    document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
  }
  
  async handleVisibilityChange() {
    if (!this.active) return;
    
    if (document.hidden) {
      // Tab switched away
      this.tabSwitchCount++;
      this.lastSwitchTime = new Date();
      
      console.warn('⚠️ Tab switched away');
      
      // Report if excessive tab switching
      if (this.tabSwitchCount > 5) {
        await this.reportExcessiveSwitching();
      }
    } else {
      // Tab switched back
      const switchDuration = this.lastSwitchTime 
        ? (new Date() - this.lastSwitchTime) / 1000 
        : 0;
      
      console.log(`✅ Tab switched back (away for ${switchDuration}s)`);
      
      // If away for too long, report
      if (switchDuration > 60) {
        await this.securityManager.reportViolation('extended_tab_switch', {
          duration: switchDuration,
          timestamp: new Date().toISOString()
        }, 'medium');
      }
    }
  }
  
  async reportExcessiveSwitching() {
    console.warn('🚨 Excessive tab switching detected');
    
    await this.securityManager.reportViolation('excessive_tab_switching', {
      switchCount: this.tabSwitchCount,
      timestamp: new Date().toISOString()
    }, 'medium');
  }
  
  stop() {
    this.active = false;
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  }
}

window.TabSwitchDetector = TabSwitchDetector;
