/**
 * Watermark Overlay
 * Dynamic, canvas-based watermarking system
 */

class WatermarkOverlay {
  constructor(config = {}) {
    this.config = {
      text: config.text || 'CONFIDENTIAL',
      position: config.position || 'diagonal',
      opacity: config.opacity || 0.3,
      fontSize: config.fontSize || 24,
      color: config.color || 'rgba(0, 0, 0, 0.3)',
      sessionId: config.sessionId,
      userId: config.userId,
      documentTitle: config.documentTitle,
      ...config
    };
    
    this.canvas = null;
    this.ctx = null;
    this.animationFrame = null;
    this.userInfo = config.userInfo || {};
  }
  
  initialize() {
    console.log('💧 Initializing watermark overlay...');
    
    this.createCanvas();
    this.render();
    
    // Update watermark periodically (dynamic info like time)
    setInterval(() => this.render(), 1000);
    
    // Re-render on resize
    window.addEventListener('resize', () => this.render());
  }
  
  createCanvas() {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'watermark-overlay';
    this.canvas.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 999999;
      mix-blend-mode: multiply;
    `;
    
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    
    this.ctx = this.canvas.getContext('2d');
    
    document.body.appendChild(this.canvas);
  }
  
  render() {
    if (!this.canvas || !this.ctx) return;
    
    // Update canvas size
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    
    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Apply rendering based on position
    switch (this.config.position) {
      case 'diagonal':
        this.renderDiagonal();
        break;
      case 'center':
        this.renderCenter();
        break;
      case 'corners':
        this.renderCorners();
        break;
      case 'floating':
        this.renderFloating();
        break;
      default:
        this.renderDiagonal();
    }
  }
  
  renderDiagonal() {
    const { ctx, canvas } = this;
    const text = this.generateWatermarkText();
    
    // Configure text
    ctx.font = `${this.config.fontSize}px Arial`;
    ctx.fillStyle = this.config.color;
    ctx.globalAlpha = this.config.opacity;
    
    // Rotate and repeat diagonally
    ctx.save();
    
    const diagonal = Math.sqrt(canvas.width ** 2 + canvas.height ** 2);
    const angle = Math.atan2(canvas.height, canvas.width);
    
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(-angle);
    
    const spacing = 200;
    const lines = Math.ceil(diagonal / spacing);
    
    for (let i = -lines; i <= lines; i++) {
      for (let j = -lines; j <= lines; j++) {
        ctx.fillText(text, i * spacing - diagonal / 2, j * spacing);
      }
    }
    
    ctx.restore();
  }
  
  renderCenter() {
    const { ctx, canvas } = this;
    const text = this.generateWatermarkText();
    
    ctx.font = `${this.config.fontSize * 2}px Arial`;
    ctx.fillStyle = this.config.color;
    ctx.globalAlpha = this.config.opacity;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  }
  
  renderCorners() {
    const { ctx, canvas } = this;
    const text = this.generateWatermarkText();
    
    ctx.font = `${this.config.fontSize}px Arial`;
    ctx.fillStyle = this.config.color;
    ctx.globalAlpha = this.config.opacity;
    
    const padding = 20;
    
    // Top-left
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(text, padding, padding);
    
    // Top-right
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(text, canvas.width - padding, padding);
    
    // Bottom-left
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(text, padding, canvas.height - padding);
    
    // Bottom-right
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(text, canvas.width - padding, canvas.height - padding);
  }
  
  renderFloating() {
    const { ctx, canvas } = this;
    const text = this.generateWatermarkText();
    
    ctx.font = `${this.config.fontSize}px Arial`;
    ctx.fillStyle = this.config.color;
    ctx.globalAlpha = this.config.opacity;
    
    // Floating watermarks at random-ish positions (but deterministic based on session)
    const positions = this.generateFloatingPositions();
    
    positions.forEach(({ x, y, rotation }) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.fillText(text, 0, 0);
      ctx.restore();
    });
  }
  
  generateFloatingPositions() {
    // Generate deterministic positions based on sessionId
    const seed = this.config.sessionId ? this.hashCode(this.config.sessionId) : 12345;
    const rng = this.seededRandom(seed);
    
    const positions = [];
    const count = 20;
    
    for (let i = 0; i < count; i++) {
      positions.push({
        x: rng() * this.canvas.width,
        y: rng() * this.canvas.height,
        rotation: (rng() - 0.5) * 0.5 // Small rotation
      });
    }
    
    return positions;
  }
  
  generateWatermarkText() {
    const parts = [];
    
    // Custom text
    if (this.config.text) {
      parts.push(this.config.text);
    }
    
    // User info
    if (this.userInfo.name) {
      parts.push(this.userInfo.name);
    }
    
    if (this.userInfo.email) {
      parts.push(this.userInfo.email);
    }
    
    // Timestamp
    parts.push(new Date().toLocaleString());
    
    // Session ID (shortened)
    if (this.config.sessionId) {
      parts.push(`Session: ${this.config.sessionId.substring(0, 8)}`);
    }
    
    // Document title
    if (this.config.documentTitle) {
      parts.push(this.config.documentTitle);
    }
    
    return parts.join(' | ');
  }
  
  // Utility: Hash code generator
  hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
  
  // Utility: Seeded random number generator
  seededRandom(seed) {
    let value = seed;
    return function() {
      value = (value * 9301 + 49297) % 233280;
      return value / 233280;
    };
  }
  
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.render();
  }
  
  destroy() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
    
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  }
}

window.WatermarkOverlay = WatermarkOverlay;
