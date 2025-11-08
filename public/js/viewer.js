/**
 * Viewer Main Script
 * Orchestrates document viewing with security and camera monitoring
 */

(async function() {
  'use strict';
  
  // Configuration
  const API_BASE = '/api';
  const DOCUMENT_ID = new URLSearchParams(window.location.search).get('id');
  const TOKEN = localStorage.getItem('authToken');
  
  if (!DOCUMENT_ID) {
    alert('No document ID specified');
    window.location.href = '/';
    return;
  }
  
  if (!TOKEN) {
    alert('Authentication required');
    window.location.href = '/login.html?redirect=' + encodeURIComponent(window.location.href);
    return;
  }
  
  // State
  let sessionId = null;
  let documentConfig = null;
  let securityManager = null;
  let cameraMonitor = null;
  let watermark = null;
  let socket = null;
  
  // DOM Elements
  const elements = {
    cameraModal: document.getElementById('camera-modal'),
    verificationVideo: document.getElementById('verification-video'),
    verificationStatus: document.getElementById('verification-status'),
    startVerificationBtn: document.getElementById('start-verification'),
    
    viewerContainer: document.getElementById('viewer-container'),
    documentTitle: document.getElementById('document-title'),
    documentInfo: document.getElementById('document-info'),
    documentContent: document.getElementById('document-content'),
    
    securityStatus: document.getElementById('security-status'),
    endSessionBtn: document.getElementById('end-session-btn'),
    
    violationWarning: document.getElementById('violation-warning'),
    violationMessage: document.getElementById('violation-message'),
    violationCount: document.getElementById('violation-count'),
    acknowledgeBtn: document.getElementById('acknowledge-btn'),
    
    terminatedScreen: document.getElementById('terminated-screen'),
    terminationReason: document.getElementById('termination-reason')
  };
  
  // Initialize
  async function initialize() {
    console.log('🚀 Initializing secure viewer...');
    
    try {
      // Generate device fingerprint
      const fingerprinter = new window.DeviceFingerprint();
      const fingerprint = await fingerprinter.generate();
      console.log('Device fingerprint:', fingerprint.hash);
      
      // Fetch document
      const response = await fetch(`${API_BASE}/documents/${DOCUMENT_ID}/view`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
          'X-Device-Fingerprint': fingerprint.hash
        }
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to load document');
      }
      
      const data = await response.json();
      documentConfig = data.document;
      sessionId = data.sessionId;
      
      console.log('✅ Document loaded:', documentConfig.title);
      
      // Update UI
      elements.documentTitle.textContent = documentConfig.title;
      elements.documentInfo.textContent = `Type: ${documentConfig.fileType} | Security Level: ${documentConfig.permissions.securityLevel}`;
      
      // Initialize Socket.IO
      initializeSocket();
      
      // Check if camera verification is required
      if (documentConfig.permissions.requireCameraVerification) {
        await performCameraVerification();
      }
      
      // Render document
      renderDocument(data.content);
      
      // Initialize security
      initializeSecurity();
      
      // Initialize watermark
      initializeWatermark();
      
      // Initialize camera monitoring (if required)
      if (documentConfig.permissions.requireCameraVerification) {
        initializeCameraMonitoring();
      }
      
    } catch (err) {
      console.error('Initialization error:', err);
      alert(`Error: ${err.message}`);
      window.location.href = '/';
    }
  }
  
  function initializeSocket() {
    socket = io({
      auth: { token: TOKEN }
    });
    
    socket.on('connect', () => {
      console.log('🔌 Socket connected');
      socket.emit('join-session', { sessionId });
    });
    
    socket.on('session-terminated', (data) => {
      console.log('🚫 Session terminated by server');
      handleSessionTermination(data.reason);
    });
    
    socket.on('document-revoked', (data) => {
      console.log('🚫 Document access revoked');
      handleSessionTermination('Document access has been revoked by the owner');
    });
    
    socket.on('disconnect', () => {
      console.log('🔌 Socket disconnected');
    });
  }
  
  async function performCameraVerification() {
    console.log('📷 Starting camera verification...');
    
    elements.cameraModal.classList.remove('hidden');
    
    return new Promise((resolve, reject) => {
      elements.startVerificationBtn.addEventListener('click', async () => {
        try {
          elements.startVerificationBtn.disabled = true;
          elements.verificationStatus.classList.add('status-loading');
          
          // Request camera access
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 1280, height: 720 } 
          });
          
          elements.verificationVideo.srcObject = stream;
          
          // Wait for face-api.js to load
          await loadFaceModels();
          
          // Perform verification
          await new Promise(r => setTimeout(r, 2000)); // Wait for video to stabilize
          
          const video = elements.verificationVideo;
          const detection = await faceapi
            .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptor();
          
          if (!detection) {
            throw new Error('No face detected. Please position your face clearly in the frame.');
          }
          
          // Capture frame
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0);
          const captureData = canvas.toDataURL('image/jpeg', 0.8);
          
          // Send to server for verification
          const response = await fetch(`${API_BASE}/camera/verify`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${TOKEN}`
            },
            body: JSON.stringify({
              sessionId,
              captureData,
              faceDescriptor: Array.from(detection.descriptor)
            })
          });
          
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Verification failed');
          }
          
          // Stop video stream
          stream.getTracks().forEach(track => track.stop());
          
          elements.verificationStatus.classList.remove('status-loading');
          elements.verificationStatus.classList.add('status-success');
          elements.verificationStatus.innerHTML = '<span>✅</span><span>Verification successful!</span>';
          
          setTimeout(() => {
            elements.cameraModal.classList.add('hidden');
            resolve();
          }, 1500);
          
        } catch (err) {
          console.error('Verification error:', err);
          elements.verificationStatus.classList.remove('status-loading');
          elements.verificationStatus.classList.add('status-error');
          elements.verificationStatus.innerHTML = `<span>❌</span><span>${err.message}</span>`;
          elements.startVerificationBtn.disabled = false;
          reject(err);
        }
      }, { once: true });
    });
  }
  
  async function loadFaceModels() {
    const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';
    
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
    ]);
  }
  
  function renderDocument(content) {
    // Clear loading spinner
    elements.documentContent.innerHTML = '';
    
    // Render based on file type
    if (documentConfig.fileType === 'application/pdf') {
      renderPDF(content);
    } else if (documentConfig.fileType.startsWith('image/')) {
      renderImage(content);
    } else if (documentConfig.fileType.startsWith('text/')) {
      renderText(content);
    } else {
      elements.documentContent.innerHTML = '<p>Unsupported file type</p>';
    }
  }
  
  function renderPDF(base64Content) {
    const iframe = document.createElement('iframe');
    iframe.src = `data:application/pdf;base64,${base64Content}`;
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    elements.documentContent.appendChild(iframe);
  }
  
  function renderImage(base64Content) {
    const img = document.createElement('img');
    img.src = `data:${documentConfig.fileType};base64,${base64Content}`;
    img.style.maxWidth = '100%';
    img.style.height = 'auto';
    elements.documentContent.appendChild(img);
  }
  
  function renderText(base64Content) {
    const text = atob(base64Content);
    const pre = document.createElement('pre');
    pre.textContent = text;
    pre.style.whiteSpace = 'pre-wrap';
    pre.style.wordWrap = 'break-word';
    elements.documentContent.appendChild(pre);
  }
  
  function initializeSecurity() {
    console.log('🔒 Initializing security...');
    
    securityManager = new window.SecurityManager({
      sessionId,
      documentId: DOCUMENT_ID,
      securityLevel: documentConfig.permissions.securityLevel,
      maxViolations: documentConfig.permissions.maxViolations || 5,
      features: {
        blockScreenshots: documentConfig.permissions.blockScreenshots !== false,
        blockPrinting: documentConfig.permissions.blockPrinting !== false,
        blockCopyPaste: documentConfig.permissions.blockCopyPaste !== false,
        blockDevTools: documentConfig.permissions.blockDevTools !== false
      }
    });
    
    securityManager.initialize();
  }
  
  function initializeWatermark() {
    if (!documentConfig.watermark || !documentConfig.watermark.visible) {
      return;
    }
    
    console.log('💧 Initializing watermark...');
    
    watermark = new window.WatermarkOverlay({
      text: documentConfig.watermark.text,
      position: documentConfig.watermark.position,
      opacity: documentConfig.watermark.opacity,
      fontSize: documentConfig.watermark.fontSize,
      sessionId,
      documentTitle: documentConfig.title,
      userInfo: {
        name: localStorage.getItem('userName'),
        email: localStorage.getItem('userEmail')
      }
    });
    
    watermark.initialize();
  }
  
  function initializeCameraMonitoring() {
    console.log('📹 Initializing camera monitoring...');
    
    cameraMonitor = new window.CameraMonitor({
      sessionId,
      interval: documentConfig.permissions.securityLevel === 'MAXIMUM' ? 5000 : 10000,
      strictMode: documentConfig.permissions.securityLevel === 'MAXIMUM'
    });
    
    cameraMonitor.initialize().catch(err => {
      console.error('Camera monitoring error:', err);
    });
  }
  
  function handleSessionTermination(reason) {
    console.log('🚫 Terminating session:', reason);
    
    // Stop all monitoring
    if (securityManager) {
      securityManager.destroy();
    }
    
    if (cameraMonitor) {
      cameraMonitor.stop();
    }
    
    if (watermark) {
      watermark.destroy();
    }
    
    // Show termination screen
    elements.terminationReason.textContent = reason;
    elements.terminatedScreen.classList.remove('hidden');
    elements.viewerContainer.style.display = 'none';
  }
  
  // Event Listeners
  elements.endSessionBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to end this viewing session?')) {
      try {
        await fetch(`${API_BASE}/monitoring/heartbeat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${TOKEN}`
          },
          body: JSON.stringify({
            sessionId,
            action: 'end'
          })
        });
        
        window.location.href = '/';
      } catch (err) {
        console.error('End session error:', err);
      }
    }
  });
  
  elements.acknowledgeBtn.addEventListener('click', () => {
    elements.violationWarning.classList.add('hidden');
  });
  
  // Start
  initialize();
  
})();
