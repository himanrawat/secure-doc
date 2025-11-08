/**
 * Copy/Paste Detector
 * Prevents text selection and copying
 */

class CopyPasteDetector {
  constructor(securityManager) {
    this.securityManager = securityManager;
    this.active = false;
  }
  
  start() {
    this.active = true;
    console.log('✅ Copy/Paste Detector: Active');
    
    // Prevent text selection via CSS
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';
    document.body.style.mozUserSelect = 'none';
    document.body.style.msUserSelect = 'none';
    
    // Prevent copy/cut/paste events
    document.addEventListener('copy', this.handleCopy.bind(this));
    document.addEventListener('cut', this.handleCut.bind(this));
    document.addEventListener('paste', this.handlePaste.bind(this));
    
    // Prevent selection events
    document.addEventListener('selectstart', this.handleSelectStart.bind(this));
    document.addEventListener('mousedown', this.handleMouseDown.bind(this));
    
    // Prevent drag events
    document.addEventListener('dragstart', this.handleDragStart.bind(this));
  }
  
  async handleCopy(e) {
    if (!this.active) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    console.warn('🚨 Copy attempt detected');
    
    await this.securityManager.reportViolation('copy_attempt', {
      timestamp: new Date().toISOString()
    }, 'medium');
    
    return false;
  }
  
  handleCut(e) {
    if (!this.active) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    console.warn('🚨 Cut attempt detected');
    
    return false;
  }
  
  handlePaste(e) {
    if (!this.active) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    return false;
  }
  
  handleSelectStart(e) {
    if (!this.active) return;
    
    // Allow selection in input fields if needed
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      return true;
    }
    
    e.preventDefault();
    return false;
  }
  
  handleMouseDown(e) {
    if (!this.active) return;
    
    // Prevent text selection on drag
    if (e.detail > 1) {
      e.preventDefault();
      return false;
    }
  }
  
  handleDragStart(e) {
    if (!this.active) return;
    
    e.preventDefault();
    return false;
  }
  
  stop() {
    this.active = false;
    
    // Restore text selection
    document.body.style.userSelect = '';
    document.body.style.webkitUserSelect = '';
    document.body.style.mozUserSelect = '';
    document.body.style.msUserSelect = '';
    
    // Remove event listeners
    document.removeEventListener('copy', this.handleCopy);
    document.removeEventListener('cut', this.handleCut);
    document.removeEventListener('paste', this.handlePaste);
    document.removeEventListener('selectstart', this.handleSelectStart);
    document.removeEventListener('mousedown', this.handleMouseDown);
    document.removeEventListener('dragstart', this.handleDragStart);
  }
}

window.CopyPasteDetector = CopyPasteDetector;
