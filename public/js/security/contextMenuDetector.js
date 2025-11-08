/**
 * Context Menu Detector
 * Disables right-click context menu
 */

class ContextMenuDetector {
  constructor(securityManager) {
    this.securityManager = securityManager;
    this.active = false;
  }
  
  start() {
    this.active = true;
    console.log('✅ Context Menu Detector: Active');
    
    // Disable context menu
    document.addEventListener('contextmenu', this.handleContextMenu.bind(this));
  }
  
  handleContextMenu(e) {
    if (!this.active) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    console.warn('Context menu attempt blocked');
    
    return false;
  }
  
  stop() {
    this.active = false;
    document.removeEventListener('contextmenu', this.handleContextMenu);
  }
}

window.ContextMenuDetector = ContextMenuDetector;
