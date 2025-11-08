/**
 * Camera Monitor
 * Handles camera access, verification, and continuous monitoring
 * Integrates with face-api.js for facial recognition
 */

class CameraMonitor {
  constructor(config = {}) {
    this.config = {
      sessionId: config.sessionId,
      requireCamera: config.requireCamera !== false,
      securityLevel: config.securityLevel || 'MEDIUM',
      verificationInterval: config.verificationInterval || 10000,
      ...config
    };
    
    this.stream = null;
    this.videoElement = null;
    this.canvasElement = null;
    this.initialFaceDescriptor = null;
    this.isVerified = false;
    this.isMonitoring = false;
    this.verificationInterval = null;
    this.modelsLoaded = false;
  }
  
  async initialize() {
    console.log('📹 Initializing Camera Monitor...');
    
    // Load face-api.js models
    await this.loadModels();
    
    // Request camera access
    await this.requestCameraAccess();
    
    // Create video element
    this.createVideoElement();
    
    // Perform initial verification
    if (this.config.requireCamera) {
      await this.performInitialVerification();
    }
    
    // Start continuous monitoring
    if (['HIGH', 'MAXIMUM'].includes(this.config.securityLevel)) {
      this.startContinuousMonitoring();
    }
  }
  
  async loadModels() {
    console.log('Loading AI models...');
    
    try {
      // Load face-api.js models from CDN
      const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';
      
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL)
      ]);
      
      this.modelsLoaded = true;
      console.log('✅ AI models loaded successfully');
    } catch (error) {
      console.error('❌ Error loading AI models:', error);
      throw new Error('Failed to load face detection models');
    }
  }
  
  async requestCameraAccess() {
    console.log('Requesting camera access...');
    
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: false
      });
      
      console.log('✅ Camera access granted');
      return true;
    } catch (error) {
      console.error('❌ Camera access denied:', error);
      
      if (this.config.requireCamera) {
        this.showCameraError();
        throw new Error('Camera access is required to view this document');
      }
      
      return false;
    }
  }
  
  createVideoElement() {
    // Create video element
    this.videoElement = document.createElement('video');
    this.videoElement.id = 'camera-feed';
    this.videoElement.autoplay = true;
    this.videoElement.muted = true;
    this.videoElement.playsInline = true;
    this.videoElement.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 200px;
      height: 150px;
      border: 3px solid #4CAF50;
      border-radius: 10px;
      z-index: 9999;
      object-fit: cover;
      box-shadow: 0 4px 6px rgba(0,0,0,0.3);
    `;
    
    // Attach stream
    this.videoElement.srcObject = this.stream;
    
    // Create canvas for processing
    this.canvasElement = document.createElement('canvas');
    
    // Add to document
    document.body.appendChild(this.videoElement);
  }
  
  async performInitialVerification() {
    console.log('Performing initial face verification...');
    
    // Wait for video to be ready
    await new Promise((resolve) => {
      this.videoElement.onloadedmetadata = () => {
        this.videoElement.play();
        resolve();
      };
    });
    
    // Wait a bit for camera to adjust
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Detect face
    const detection = await faceapi
      .detectSingleFace(this.videoElement, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();
    
    if (!detection) {
      this.showVerificationError('No face detected. Please ensure your face is visible to the camera.');
      throw new Error('Face verification failed');
    }
    
    // Store initial face descriptor
    this.initialFaceDescriptor = detection.descriptor;
    
    // Capture initial frame
    const imageData = await this.captureFrame();
    
    // Send to server for verification
    await this.sendVerificationToServer(imageData, this.initialFaceDescriptor);
    
    this.isVerified = true;
    console.log('✅ Initial face verification successful');
    
    this.showVerificationSuccess();
  }
  
  async sendVerificationToServer(imageData, faceDescriptor) {
    try {
      const response = await fetch('/api/camera/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          sessionId: this.config.sessionId,
          imageData,
          faceDescriptor: Array.from(faceDescriptor)
        })
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Verification failed');
      }
      
      return data;
    } catch (error) {
      console.error('Verification error:', error);
      throw error;
    }
  }
  
  startContinuousMonitoring() {
    console.log('🔍 Starting continuous camera monitoring...');
    this.isMonitoring = true;
    
    const interval = this.config.verificationInterval;
    
    this.verificationInterval = setInterval(async () => {
      await this.performContinuousValidation();
    }, interval);
  }
  
  async performContinuousValidation() {
    if (!this.isMonitoring || !this.modelsLoaded) return;
    
    try {
      // Detect current face
      const detection = await faceapi
        .detectSingleFace(this.videoElement, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();
      
      const imageData = await this.captureFrame();
      
      // Check for various violations
      const violations = [];
      
      // 1. No face detected (obstruction or absence)
      if (!detection) {
        violations.push({
          type: 'camera_obstruction',
          obstructionDetected: true
        });
      } else {
        // 2. Face mismatch
        const distance = faceapi.euclideanDistance(this.initialFaceDescriptor, detection.descriptor);
        const matchScore = 1 - distance;
        
        if (matchScore < parseFloat(process.env.FACE_MATCH_THRESHOLD || 0.6)) {
          violations.push({
            type: 'face_mismatch',
            faceMatchScore: matchScore
          });
        }
      }
      
      // 3. Multiple faces (multiple persons)
      const allDetections = await faceapi
        .detectAllFaces(this.videoElement, new faceapi.TinyFaceDetectorOptions());
      
      if (allDetections.length > 1) {
        violations.push({
          type: 'multiple_persons',
          multiplePersonsDetected: true,
          personCount: allDetections.length
        });
      }
      
      // 4. External camera/phone detection (using COCO-SSD via TensorFlow.js)
      const externalCameraDetected = await this.detectExternalCamera(imageData);
      if (externalCameraDetected) {
        violations.push({
          type: 'external_camera',
          externalCameraDetected: true
        });
      }
      
      // 5. Check for blinks (liveness)
      if (detection && this.config.securityLevel === 'MAXIMUM') {
        const blinkDetected = this.detectBlink(detection.landmarks);
        if (blinkDetected) {
          console.log('👁️ Blink detected (liveness confirmed)');
        }
      }
      
      // 6. Average brightness (obstruction check)
      const avgBrightness = this.calculateAverageBrightness(imageData);
      
      // Send validation to server
      await this.sendValidationToServer({
        imageData,
        faceDescriptor: detection ? Array.from(detection.descriptor) : null,
        faceMatchScore: detection ? 1 - faceapi.euclideanDistance(this.initialFaceDescriptor, detection.descriptor) : 0,
        obstructionDetected: !detection || avgBrightness < 10,
        externalCameraDetected,
        multiplePersonsDetected: allDetections.length > 1,
        blinkDetected: detection ? this.detectBlink(detection.landmarks) : false,
        averageBrightness: avgBrightness
      });
      
    } catch (error) {
      console.error('Continuous validation error:', error);
    }
  }
  
  async sendValidationToServer(validationData) {
    try {
      const response = await fetch('/api/camera/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          sessionId: this.config.sessionId,
          ...validationData
        })
      });
      
      const data = await response.json();
      
      if (data.sessionTerminated) {
        this.stopMonitoring();
        if (window.securityManager) {
          window.securityManager.handleSessionTermination({
            reason: 'Security violations exceeded'
          });
        }
      } else if (!data.validated && data.violations) {
        console.warn('⚠️ Camera validation violations:', data.violations);
        this.updateCameraBorder('warning');
      } else {
        this.updateCameraBorder('success');
      }
    } catch (error) {
      console.error('Validation error:', error);
    }
  }
  
  async detectExternalCamera(imageData) {
    // This would use TensorFlow.js COCO-SSD model to detect phones/cameras
    // Simplified version - in production, load and use COCO-SSD model
    // For now, return false as placeholder
    return false;
    
    /* Production implementation would be:
    if (!window.cocoSsdModel) {
      window.cocoSsdModel = await cocoSsd.load();
    }
    const predictions = await window.cocoSsdModel.detect(this.videoElement);
    const phoneDetected = predictions.some(p => 
      p.class === 'cell phone' && p.score > 0.7
    );
    return phoneDetected;
    */
  }
  
  detectBlink(landmarks) {
    // Eye Aspect Ratio (EAR) calculation for blink detection
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();
    
    const leftEAR = this.calculateEAR(leftEye);
    const rightEAR = this.calculateEAR(rightEye);
    const avgEAR = (leftEAR + rightEAR) / 2;
    
    // EAR < 0.25 typically indicates closed eye
    const threshold = parseFloat(process.env.BLINK_DETECTION_EAR_THRESHOLD || 0.25);
    return avgEAR < threshold;
  }
  
  calculateEAR(eye) {
    // Eye Aspect Ratio formula
    const v1 = this.euclideanDist(eye[1], eye[5]);
    const v2 = this.euclideanDist(eye[2], eye[4]);
    const h = this.euclideanDist(eye[0], eye[3]);
    return (v1 + v2) / (2.0 * h);
  }
  
  euclideanDist(p1, p2) {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
  }
  
  calculateAverageBrightness(imageDataUrl) {
    // Convert data URL to image and calculate average brightness
    const img = new Image();
    img.src = imageDataUrl;
    
    // Simplified - in production, analyze actual pixel data
    // Return dummy value for now
    return 50; // 0-255 scale
  }
  
  async captureFrame() {
    // Draw current video frame to canvas
    this.canvasElement.width = this.videoElement.videoWidth;
    this.canvasElement.height = this.videoElement.videoHeight;
    
    const ctx = this.canvasElement.getContext('2d');
    ctx.drawImage(this.videoElement, 0, 0);
    
    // Return as data URL
    return this.canvasElement.toDataURL('image/jpeg', 0.8);
  }
  
  updateCameraBorder(status) {
    if (!this.videoElement) return;
    
    const colors = {
      success: '#4CAF50',
      warning: '#FF9800',
      error: '#F44336'
    };
    
    this.videoElement.style.borderColor = colors[status] || colors.success;
  }
  
  showVerificationSuccess() {
    const notification = document.createElement('div');
    notification.className = 'camera-notification success';
    notification.innerHTML = '✅ Camera verification successful';
    document.body.appendChild(notification);
    
    setTimeout(() => notification.remove(), 3000);
  }
  
  showVerificationError(message) {
    const notification = document.createElement('div');
    notification.className = 'camera-notification error';
    notification.innerHTML = `❌ ${message}`;
    document.body.appendChild(notification);
  }
  
  showCameraError() {
    document.body.innerHTML = `
      <div class="camera-error-screen">
        <div class="error-content">
          <h1>📹 Camera Access Required</h1>
          <p>This document requires camera access for security verification.</p>
          <p>Please enable camera permissions and refresh the page.</p>
          <button onclick="location.reload()">Refresh Page</button>
        </div>
      </div>
    `;
  }
  
  stopMonitoring() {
    console.log('Stopping camera monitoring...');
    this.isMonitoring = false;
    
    if (this.verificationInterval) {
      clearInterval(this.verificationInterval);
    }
  }
  
  destroy() {
    this.stopMonitoring();
    
    // Stop camera stream
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
    
    // Remove video element
    if (this.videoElement && this.videoElement.parentNode) {
      this.videoElement.parentNode.removeChild(this.videoElement);
    }
  }
  
  isActive() {
    return this.isMonitoring && this.stream && this.stream.active;
  }
}

window.CameraMonitor = CameraMonitor;
