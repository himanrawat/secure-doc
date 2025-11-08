const express = require('express');
const router = express.Router();
const Session = require('../models/Session');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');

// Initial camera verification
router.post('/verify', authMiddleware, async (req, res) => {
  try {
    const { sessionId, imageData, faceDescriptor } = req.body;
    
    if (!sessionId || !imageData || !faceDescriptor) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const session = await Session.findOne({ sessionId });
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Store initial capture and face descriptor
    session.cameraVerification.initialCapture = imageData;
    session.cameraVerification.faceDescriptor = faceDescriptor;
    session.cameraVerification.verified = true;
    session.cameraVerification.lastVerification = new Date();
    session.cameraVerification.verificationCount = 1;
    
    await session.save();
    await session.addActivity('camera_verified', { initial: true });
    
    // Optionally store face descriptor in user profile for future verification
    const user = await User.findOne({ userId: session.userId });
    if (!user.faceDescriptor || user.faceDescriptor.length === 0) {
      user.faceDescriptor = faceDescriptor;
      await user.save();
    }
    
    res.json({
      success: true,
      verified: true,
      message: 'Camera verification successful'
    });
  } catch (error) {
    console.error('Camera verify error:', error);
    res.status(500).json({ error: 'Error verifying camera' });
  }
});

// Continuous validation
router.post('/validate', authMiddleware, async (req, res) => {
  try {
    const { 
      sessionId, 
      imageData, 
      faceDescriptor, 
      faceMatchScore = 0,
      obstructionDetected = false,
      externalCameraDetected = false,
      multiplePersonsDetected = false,
      blinkDetected = false,
      averageBrightness = 0
    } = req.body;
    
    const session = await Session.findOne({ sessionId, status: 'active' });
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found or ended' });
    }
    
    const violations = [];
    const document = await require('../models/Document').findOne({ 
      documentId: session.documentId 
    });
    
    // Check obstruction (black frame detection)
    if (obstructionDetected || averageBrightness < parseInt(process.env.OBSTRUCTION_THRESHOLD || '10')) {
      await session.addViolation('camera_obstruction', {
        imageData,
        brightness: averageBrightness
      }, 'high');
      violations.push({ type: 'camera_obstruction', message: 'Camera appears to be obstructed' });
    }
    
    // Check external camera/phone detection
    if (externalCameraDetected) {
      await session.addViolation('external_camera_detected', {
        imageData,
        confidence: req.body.externalCameraConfidence || 0
      }, 'critical');
      violations.push({ type: 'external_camera_detected', message: 'External recording device detected' });
    }
    
    // Check face matching
    const matchThreshold = parseFloat(process.env.FACE_MATCH_THRESHOLD || '0.6');
    if (faceMatchScore < matchThreshold && faceMatchScore > 0) {
      await session.addViolation('face_mismatch', {
        imageData,
        matchScore: faceMatchScore,
        threshold: matchThreshold
      }, 'high');
      violations.push({ type: 'face_mismatch', message: 'Face does not match authorized user' });
    }
    
    // Check multiple persons
    if (multiplePersonsDetected) {
      await session.addViolation('multiple_persons', {
        imageData
      }, 'high');
      violations.push({ type: 'multiple_persons', message: 'Multiple persons detected in frame' });
    }
    
    // Update verification data
    session.cameraVerification.lastVerification = new Date();
    session.cameraVerification.verificationCount += 1;
    
    // Update blink count if detected
    if (blinkDetected) {
      session.analytics.blinkCount += 1;
    }
    
    await session.save();
    
    // Check if violations exceed threshold
    const totalViolations = session.violations.length;
    const maxViolations = document.permissions.maxViolations;
    
    if (totalViolations >= maxViolations) {
      await session.endSession('violated');
      
      return res.json({
        success: false,
        validated: false,
        violations,
        sessionTerminated: true,
        message: 'Session terminated due to security violations'
      });
    }
    
    res.json({
      success: true,
      validated: violations.length === 0,
      violations,
      verificationCount: session.cameraVerification.verificationCount,
      remainingViolations: maxViolations - totalViolations
    });
  } catch (error) {
    console.error('Camera validate error:', error);
    res.status(500).json({ error: 'Error validating camera' });
  }
});

// Get camera requirements for document
router.get('/requirements/:documentId', authMiddleware, async (req, res) => {
  try {
    const { documentId } = req.params;
    
    const document = await require('../models/Document').findOne({ documentId });
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    res.json({
      success: true,
      requirements: {
        requireCamera: document.permissions.requireCamera,
        securityLevel: document.permissions.securityLevel,
        continuousMonitoring: ['HIGH', 'MAXIMUM'].includes(document.permissions.securityLevel),
        livenessDetection: document.permissions.securityLevel === 'MAXIMUM',
        externalCameraDetection: ['HIGH', 'MAXIMUM'].includes(document.permissions.securityLevel),
        multiplePersonDetection: ['HIGH', 'MAXIMUM'].includes(document.permissions.securityLevel),
        verificationInterval: document.permissions.securityLevel === 'MAXIMUM' ? 5000 : 10000
      }
    });
  } catch (error) {
    console.error('Get camera requirements error:', error);
    res.status(500).json({ error: 'Error fetching camera requirements' });
  }
});

module.exports = router;
