const express = require('express');
const router = express.Router();
const Session = require('../models/Session');
const Document = require('../models/Document');
const { authMiddleware } = require('../middleware/auth');
const notificationService = require('../services/notificationService');

// Session heartbeat
router.post('/heartbeat', authMiddleware, async (req, res) => {
  try {
    const { sessionId, currentPage, scrollDepth, attentionScore } = req.body;
    
    const session = await Session.findOne({ sessionId, status: 'active' });
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found or ended' });
    }
    
    // Update heartbeat with analytics
    await session.updateHeartbeat({
      currentPage,
      scrollDepth,
      attentionScore
    });
    
    res.json({
      success: true,
      sessionStatus: 'active'
    });
  } catch (error) {
    console.error('Heartbeat error:', error);
    res.status(500).json({ error: 'Error updating heartbeat' });
  }
});

// Report violation
router.post('/violation', authMiddleware, async (req, res) => {
  try {
    const { 
      sessionId, 
      violationType, 
      evidence = {}, 
      severity = 'medium' 
    } = req.body;
    
    const session = await Session.findOne({ sessionId });
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Add violation
    const violationCount = await session.addViolation(violationType, evidence, severity);
    
    // Log activity
    await session.addActivity('violation_detected', { violationType, severity });
    
    // Get document for permissions
    const document = await Document.findOne({ documentId: session.documentId });
    
    // Check if max violations reached
    if (violationCount >= document.permissions.maxViolations) {
      await session.endSession('violated');
      
      // Notify via Socket.IO
      if (global.io) {
        global.io.to(`session-${sessionId}`).emit('session-terminated', {
          reason: 'Maximum violations reached',
          violationCount
        });
      }
      
      // Notify owner
      await notificationService.notifyViolation(document.ownerId, {
        documentId: document.documentId,
        documentTitle: document.title,
        userId: session.userId,
        violationType,
        violationCount,
        sessionId,
        evidence
      });
      
      return res.json({
        success: true,
        sessionTerminated: true,
        violationCount,
        message: 'Session terminated due to violations'
      });
    }
    
    // Notify owner of violation
    await notificationService.notifyViolation(document.ownerId, {
      documentId: document.documentId,
      documentTitle: document.title,
      userId: session.userId,
      violationType,
      violationCount,
      maxViolations: document.permissions.maxViolations,
      sessionId,
      evidence
    });
    
    // Update dashboard in real-time
    if (global.io) {
      global.io.to(`dashboard-${document.ownerId}`).emit('violation-detected', {
        sessionId,
        documentId: document.documentId,
        violationType,
        violationCount,
        timestamp: new Date()
      });
    }
    
    res.json({
      success: true,
      violationCount,
      remainingViolations: document.permissions.maxViolations - violationCount,
      warningMessage: `${document.permissions.maxViolations - violationCount} violations remaining before session termination`
    });
  } catch (error) {
    console.error('Violation error:', error);
    res.status(500).json({ error: 'Error reporting violation' });
  }
});

// End session
router.post('/end-session', authMiddleware, async (req, res) => {
  try {
    const { sessionId, reason = 'normal' } = req.body;
    
    const session = await Session.findOne({ sessionId });
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    await session.endSession(reason);
    await session.addActivity('document_closed', { reason });
    
    res.json({
      success: true,
      message: 'Session ended successfully'
    });
  } catch (error) {
    console.error('End session error:', error);
    res.status(500).json({ error: 'Error ending session' });
  }
});

// Get session details
router.get('/session/:sessionId', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const session = await Session.findOne({ sessionId });
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Check if user is owner of document or session owner
    const document = await Document.findOne({ documentId: session.documentId });
    
    if (document.ownerId !== req.userId && session.userId !== req.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    res.json({
      success: true,
      session: {
        sessionId: session.sessionId,
        documentId: session.documentId,
        userId: session.userId,
        startTime: session.startTime,
        endTime: session.endTime,
        status: session.status,
        violations: session.violations,
        activityLog: session.activityLog,
        analytics: session.analytics,
        securityMetrics: session.securityMetrics
      }
    });
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ error: 'Error fetching session' });
  }
});

// Log activity
router.post('/activity', authMiddleware, async (req, res) => {
  try {
    const { sessionId, action, metadata = {} } = req.body;
    
    const session = await Session.findOne({ sessionId, status: 'active' });
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found or ended' });
    }
    
    await session.addActivity(action, metadata);
    
    res.json({
      success: true,
      message: 'Activity logged'
    });
  } catch (error) {
    console.error('Activity log error:', error);
    res.status(500).json({ error: 'Error logging activity' });
  }
});

// Update eye tracking data
router.post('/eye-tracking', authMiddleware, async (req, res) => {
  try {
    const { sessionId, gazeX, gazeY, attentionScore } = req.body;
    
    const session = await Session.findOne({ sessionId, status: 'active' });
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found or ended' });
    }
    
    session.analytics.eyeTrackingData.push({
      timestamp: new Date(),
      gazeX,
      gazeY,
      attentionScore
    });
    
    // Keep only last 100 entries to prevent document bloat
    if (session.analytics.eyeTrackingData.length > 100) {
      session.analytics.eyeTrackingData = session.analytics.eyeTrackingData.slice(-100);
    }
    
    await session.save();
    
    res.json({
      success: true
    });
  } catch (error) {
    console.error('Eye tracking error:', error);
    res.status(500).json({ error: 'Error updating eye tracking' });
  }
});

module.exports = router;
