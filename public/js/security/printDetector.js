/**
 * Print Detector
 * Prevents document printing
 */

class PrintDetector {
  constructor(securityManager) {
    this.securityManager = securityManager;
    this.active = false;
  }
  
  start() {
    this.active = true;
    console.log('✅ Print Detector: Active');
    
    // Keyboard shortcuts (Ctrl+P / Cmd+P)
    document.addEventListener('keydown', this.handleKeyDown.bind(this), true);
    
    // Before print event
    window.addEventListener('beforeprint', this.handleBeforePrint.bind(this));
    
    // After print event
    window.addEventListener('afterprint', this.handleAfterPrint.bind(this));
    
    // Inject CSS to hide content when printing
    this.injectPrintCSS();
  }
  
  handleKeyDown(e) {
    if (!this.active) return;
    
    // Ctrl+P or Cmd+P
    if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
      e.preventDefault();
      e.stopPropagation();
      this.reportPrintAttempt('keyboard_shortcut');
      return false;
    }
  }
  
  async handleBeforePrint(e) {
    if (!this.active) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    this.reportPrintAttempt('print_dialog');
    
    // Hide all content
    document.body.style.display = 'none';
    
    return false;
  }
  
  handleAfterPrint() {
    // Restore content
    document.body.style.display = '';
  }
  
  injectPrintCSS() {
    const style = document.createElement('style');
    style.id = 'print-blocker';
    style.textContent = `
      @media print {
        body * {
          display: none !important;
        }
        body::before {
          content: "Printing is not allowed for this document.";
          display: block !important;
          font-size: 24px;
          text-align: center;
          padding: 50px;
        }
      }
    `;
    document.head.appendChild(style);
  }
  
  async reportPrintAttempt(method) {
    console.warn('🚨 Print attempt detected:', method);
    
    // Capture evidence
    let cameraSnapshot = null;
    if (window.cameraMonitor && window.cameraMonitor.isActive()) {
      cameraSnapshot = await window.cameraMonitor.captureFrame();
    }
    
    await this.securityManager.reportViolation('print_attempt', {
      method,
      timestamp: new Date().toISOString(),
      cameraSnapshot
    }, 'high');
  }
  
  stop() {
    this.active = false;
    document.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('beforeprint', this.handleBeforePrint);
    window.removeEventListener('afterprint', this.handleAfterPrint);
    
    // Remove print CSS
    const printBlocker = document.getElementById('print-blocker');
    if (printBlocker) printBlocker.remove();
  }
}

window.PrintDetector = PrintDetector;
