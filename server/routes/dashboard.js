const express = require('express');
const router = express.Router();
const Document = require('../models/Document');
const Session = require('../models/Session');
const { authMiddleware } = require('../middleware/auth');

// Get live sessions for owner
router.get('/live-sessions', authMiddleware, async (req, res) => {
  try {
    // Get all documents owned by user
    const documents = await Document.find({ 
      ownerId: req.userId, 
      status: 'active' 
    });
    
    const documentIds = documents.map(d => d.documentId);
    
    // Get active sessions for these documents
    const liveSessions = await Session.find({
      documentId: { $in: documentIds },
      status: 'active',
      lastHeartbeat: { $gt: new Date(Date.now() - 30000) } // Active in last 30 seconds
    }).sort({ startTime: -1 });
    
    // Enrich with document info
    const enrichedSessions = liveSessions.map(session => {
      const document = documents.find(d => d.documentId === session.documentId);
      return {
        sessionId: session.sessionId,
        documentId: session.documentId,
        documentTitle: document?.title || 'Unknown',
        userId: session.userId,
        startTime: session.startTime,
        lastHeartbeat: session.lastHeartbeat,
        violations: session.violations.length,
        cameraVerified: session.cameraVerification.verified,
        ipAddress: session.ipAddress,
        deviceFingerprint: session.deviceFingerprint
      };
    });
    
    res.json({
      success: true,
      sessions: enrichedSessions,
      count: enrichedSessions.length
    });
  } catch (error) {
    console.error('Get live sessions error:', error);
    res.status(500).json({ error: 'Error fetching live sessions' });
  }
});

// Alias for frontend compatibility - sessions/live
router.get('/sessions/live', authMiddleware, async (req, res) => {
  try {
    // Get all documents owned by user
    const documents = await Document.find({ 
      ownerId: req.userId, 
      status: 'active' 
    });
    
    const documentIds = documents.map(d => d.documentId);
    
    // Get active sessions for these documents
    const liveSessions = await Session.find({
      documentId: { $in: documentIds },
      status: 'active',
      lastHeartbeat: { $gt: new Date(Date.now() - 30000) }
    }).sort({ startTime: -1 });
    
    // Enrich with document info
    const enrichedSessions = liveSessions.map(session => {
      const document = documents.find(d => d.documentId === session.documentId);
      return {
        sessionId: session.sessionId,
        documentId: session.documentId,
        documentTitle: document?.title || 'Unknown',
        userId: session.userId,
        startTime: session.startTime,
        lastHeartbeat: session.lastHeartbeat,
        violations: session.violations.length,
        cameraVerified: session.cameraVerification?.verified || false,
        ipAddress: session.ipAddress,
        deviceFingerprint: session.deviceFingerprint
      };
    });
    
    res.json(enrichedSessions);
  } catch (error) {
    console.error('Get sessions/live error:', error);
    res.status(500).json({ error: 'Error fetching live sessions' });
  }
});

// Get all violations across all documents
router.get('/violations', authMiddleware, async (req, res) => {
  try {
    // Get all documents owned by user
    const documents = await Document.find({ 
      ownerId: req.userId, 
      status: { $ne: 'deleted' }
    });
    
    const documentIds = documents.map(d => d.documentId);
    
    // Get all sessions with violations
    const sessions = await Session.find({ 
      documentId: { $in: documentIds },
      'violations.0': { $exists: true }
    }).sort({ 'violations.timestamp': -1 });
    
    const allViolations = [];
    sessions.forEach(session => {
      const document = documents.find(d => d.documentId === session.documentId);
      session.violations.forEach(violation => {
        allViolations.push({
          violationId: violation._id,
          sessionId: session.sessionId,
          documentId: session.documentId,
          documentTitle: document?.title || 'Unknown',
          type: violation.type,
          severity: violation.severity,
          timestamp: violation.timestamp,
          description: violation.description,
          userId: session.userId,
          ipAddress: session.ipAddress,
          deviceFingerprint: session.deviceFingerprint
        });
      });
    });
    
    res.json(allViolations);
  } catch (error) {
    console.error('Get all violations error:', error);
    res.status(500).json({ error: 'Error fetching violations' });
  }
});

// Get recent activity logs across all documents
router.get('/logs', authMiddleware, async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    // Get all documents owned by user
    const documents = await Document.find({ 
      ownerId: req.userId, 
      status: { $ne: 'deleted' }
    });
    
    const documentIds = documents.map(d => d.documentId);
    
    // Get recent sessions with activity
    const sessions = await Session.find({ 
      documentId: { $in: documentIds },
      'activityLog.0': { $exists: true }
    })
    .sort({ 'activityLog.timestamp': -1 })
    .limit(parseInt(limit) * 5); // Get more sessions to ensure enough activities
    
    const allActivities = [];
    sessions.forEach(session => {
      const document = documents.find(d => d.documentId === session.documentId);
      session.activityLog.forEach(activity => {
        allActivities.push({
          activityId: activity._id,
          sessionId: session.sessionId,
          documentId: session.documentId,
          documentTitle: document?.title || 'Unknown',
          action: activity.action,
          timestamp: activity.timestamp,
          details: activity.details,
          userId: session.userId,
          ipAddress: session.ipAddress
        });
      });
    });
    
    // Sort by timestamp and limit
    allActivities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    res.json(allActivities.slice(0, parseInt(limit)));
  } catch (error) {
    console.error('Get activity logs error:', error);
    res.status(500).json({ error: 'Error fetching activity logs' });
  }
});

// Get document logs
router.get('/documents/:documentId/logs', authMiddleware, async (req, res) => {
  try {
    const { documentId } = req.params;
    const { limit = 100, skip = 0 } = req.query;
    
    const document = await Document.findOne({ documentId, ownerId: req.userId });
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found or access denied' });
    }
    
    const sessions = await Session.find({ documentId })
      .sort({ startTime: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));
    
    const logs = sessions.map(session => ({
      sessionId: session.sessionId,
      userId: session.userId,
      startTime: session.startTime,
      endTime: session.endTime,
      duration: session.endTime 
        ? (session.endTime - session.startTime) / 1000 
        : (new Date() - session.startTime) / 1000,
      status: session.status,
      violations: session.violations.length,
      activityCount: session.activityLog.length,
      cameraVerified: session.cameraVerification.verified
    }));
    
    res.json({
      success: true,
      logs,
      count: logs.length,
      documentId
    });
  } catch (error) {
    console.error('Get document logs error:', error);
    res.status(500).json({ error: 'Error fetching logs' });
  }
});

// Get document violations
router.get('/documents/:documentId/violations', authMiddleware, async (req, res) => {
  try {
    const { documentId } = req.params;
    
    const document = await Document.findOne({ documentId, ownerId: req.userId });
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found or access denied' });
    }
    
    const sessions = await Session.find({ documentId, 'violations.0': { $exists: true } })
      .sort({ 'violations.timestamp': -1 });
    
    const allViolations = [];
    sessions.forEach(session => {
      session.violations.forEach(violation => {
        allViolations.push({
          sessionId: session.sessionId,
          userId: session.userId,
          type: violation.type,
          timestamp: violation.timestamp,
          severity: violation.severity,
          evidence: violation.evidence ? {
            hasScreenshot: !!violation.evidence.screenshot,
            hasCameraSnapshot: !!violation.evidence.cameraSnapshot,
            metadata: violation.evidence.metadata
          } : null
        });
      });
    });
    
    res.json({
      success: true,
      violations: allViolations,
      count: allViolations.length,
      documentId
    });
  } catch (error) {
    console.error('Get violations error:', error);
    res.status(500).json({ error: 'Error fetching violations' });
  }
});

// Get analytics summary for document
router.get('/documents/:documentId/analytics', authMiddleware, async (req, res) => {
  try {
    const { documentId } = req.params;
    
    const document = await Document.findOne({ documentId, ownerId: req.userId });
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found or access denied' });
    }
    
    const sessions = await Session.find({ documentId });
    
    const analytics = {
      totalSessions: sessions.length,
      activeSessions: sessions.filter(s => s.status === 'active').length,
      completedSessions: sessions.filter(s => s.status === 'ended').length,
      violatedSessions: sessions.filter(s => s.status === 'violated').length,
      killedSessions: sessions.filter(s => s.status === 'killed').length,
      totalViolations: sessions.reduce((sum, s) => sum + s.violations.length, 0),
      totalViews: document.permissions.currentViews,
      maxViews: document.permissions.maxViews,
      averageTimeSpent: sessions.length > 0 
        ? sessions.reduce((sum, s) => sum + s.analytics.totalTimeSpent, 0) / sessions.length 
        : 0,
      violationTypes: {},
      securityMetrics: {
        cameraObstructions: sessions.reduce((sum, s) => sum + s.securityMetrics.cameraObstructionAttempts, 0),
        externalCameraDetections: sessions.reduce((sum, s) => sum + s.securityMetrics.externalCameraDetections, 0),
        faceMismatches: sessions.reduce((sum, s) => sum + s.securityMetrics.faceMismatchCount, 0),
        screenshotAttempts: sessions.reduce((sum, s) => sum + s.securityMetrics.screenshotAttempts, 0),
        focusLosses: sessions.reduce((sum, s) => sum + s.securityMetrics.focusLossCount, 0)
      }
    };
    
    // Count violation types
    sessions.forEach(session => {
      session.violations.forEach(violation => {
        if (!analytics.violationTypes[violation.type]) {
          analytics.violationTypes[violation.type] = 0;
        }
        analytics.violationTypes[violation.type]++;
      });
    });
    
    res.json({
      success: true,
      analytics,
      documentId
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ error: 'Error fetching analytics' });
  }
});

// Get dashboard overview
router.get('/overview', authMiddleware, async (req, res) => {
  try {
    const documents = await Document.find({ 
      ownerId: req.userId, 
      status: { $ne: 'deleted' }
    });
    
    const documentIds = documents.map(d => d.documentId);
    
    const [totalSessions, activeSessions, recentViolations] = await Promise.all([
      Session.countDocuments({ documentId: { $in: documentIds } }),
      Session.countDocuments({ 
        documentId: { $in: documentIds }, 
        status: 'active',
        lastHeartbeat: { $gt: new Date(Date.now() - 30000) }
      }),
      Session.find({ 
        documentId: { $in: documentIds },
        'violations.0': { $exists: true },
        'violations.timestamp': { $gt: new Date(Date.now() - 86400000) } // Last 24 hours
      }).limit(10)
    ]);
    
    const recentViolationsList = [];
    recentViolations.forEach(session => {
      const document = documents.find(d => d.documentId === session.documentId);
      session.violations
        .filter(v => new Date(v.timestamp) > new Date(Date.now() - 86400000))
        .forEach(violation => {
          recentViolationsList.push({
            documentTitle: document?.title || 'Unknown',
            documentId: session.documentId,
            type: violation.type,
            timestamp: violation.timestamp,
            severity: violation.severity
          });
        });
    });
    
    res.json({
      success: true,
      overview: {
        totalDocuments: documents.length,
        activeDocuments: documents.filter(d => d.status === 'active').length,
        totalSessions,
        activeSessions,
        recentViolations: recentViolationsList.slice(0, 10)
      }
    });
  } catch (error) {
    console.error('Get overview error:', error);
    res.status(500).json({ error: 'Error fetching overview' });
  }
});

// Export audit trail
router.get('/documents/:documentId/export', authMiddleware, async (req, res) => {
  try {
    const { documentId } = req.params;
    const { format = 'json' } = req.query;
    
    const document = await Document.findOne({ documentId, ownerId: req.userId });
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found or access denied' });
    }
    
    const sessions = await Session.find({ documentId }).sort({ startTime: -1 });
    
    const auditTrail = {
      document: {
        documentId: document.documentId,
        title: document.title,
        createdAt: document.createdAt,
        permissions: document.permissions,
        status: document.status
      },
      sessions: sessions.map(session => ({
        sessionId: session.sessionId,
        userId: session.userId,
        deviceFingerprint: session.deviceFingerprint,
        ipAddress: session.ipAddress,
        startTime: session.startTime,
        endTime: session.endTime,
        status: session.status,
        violations: session.violations,
        activityLog: session.activityLog,
        analytics: session.analytics,
        securityMetrics: session.securityMetrics
      })),
      exportedAt: new Date(),
      exportedBy: req.userId
    };
    
    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="audit-trail-${documentId}.json"`);
      res.send(JSON.stringify(auditTrail, null, 2));
    } else if (format === 'csv') {
      // Simple CSV export
      let csv = 'Session ID,User ID,Start Time,End Time,Status,Violations,Activities\n';
      sessions.forEach(session => {
        csv += `"${session.sessionId}","${session.userId}","${session.startTime}","${session.endTime || 'N/A'}","${session.status}","${session.violations.length}","${session.activityLog.length}"\n`;
      });
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="audit-trail-${documentId}.csv"`);
      res.send(csv);
    } else {
      res.status(400).json({ error: 'Invalid format. Use json or csv' });
    }
  } catch (error) {
    console.error('Export audit trail error:', error);
    res.status(500).json({ error: 'Error exporting audit trail' });
  }
});

module.exports = router;
