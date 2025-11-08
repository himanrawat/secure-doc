const Session = require('../models/Session');

class SessionManager {
  constructor() {
    this.connections = new Map(); // socketId -> sessionId mapping
    this.activeSessions = new Map(); // sessionId -> { socketId, lastHeartbeat, data }
    
    // Clean up stale sessions every minute
    setInterval(() => this.cleanupStaleSessions(), 60000);
  }
  
  /**
   * Track socket connection to session
   */
  trackConnection(sessionId, socketId) {
    this.connections.set(socketId, sessionId);
    this.activeSessions.set(sessionId, {
      socketId,
      lastHeartbeat: new Date(),
      data: {}
    });
    
    console.log(`✅ Session tracked: ${sessionId} - Socket: ${socketId}`);
  }
  
  /**
   * Update session heartbeat
   */
  async updateHeartbeat(sessionId, data = {}) {
    const sessionInfo = this.activeSessions.get(sessionId);
    
    if (sessionInfo) {
      sessionInfo.lastHeartbeat = new Date();
      sessionInfo.data = { ...sessionInfo.data, ...data };
      this.activeSessions.set(sessionId, sessionInfo);
    }
    
    // Update in database
    try {
      const session = await Session.findOne({ sessionId, status: 'active' });
      if (session) {
        await session.updateHeartbeat(data);
      }
    } catch (error) {
      console.error('Error updating heartbeat in DB:', error);
    }
  }
  
  /**
   * Handle violation
   */
  async handleViolation(data) {
    const { sessionId, violationType, evidence, severity } = data;
    
    try {
      const session = await Session.findOne({ sessionId });
      
      if (!session) {
        console.error('Session not found for violation:', sessionId);
        return;
      }
      
      await session.addViolation(violationType, evidence, severity);
      
      const document = await require('../models/Document').findOne({ 
        documentId: session.documentId 
      });
      
      // Emit to dashboard
      if (global.io && document) {
        global.io.to(`dashboard-${document.ownerId}`).emit('violation-detected', {
          sessionId,
          documentId: document.documentId,
          documentTitle: document.title,
          violationType,
          violationCount: session.violations.length,
          maxViolations: document.permissions.maxViolations,
          timestamp: new Date()
        });
      }
      
      // Check if max violations reached
      if (session.violations.length >= document.permissions.maxViolations) {
        await this.terminateSession(sessionId, 'Maximum violations reached');
      }
    } catch (error) {
      console.error('Error handling violation:', error);
    }
  }
  
  /**
   * Handle socket disconnect
   */
  async handleDisconnect(socketId) {
    const sessionId = this.connections.get(socketId);
    
    if (sessionId) {
      this.connections.delete(socketId);
      this.activeSessions.delete(sessionId);
      
      // Update session in DB
      try {
        const session = await Session.findOne({ sessionId, status: 'active' });
        if (session) {
          await session.endSession('normal');
          console.log(`Session ended: ${sessionId}`);
        }
      } catch (error) {
        console.error('Error ending session on disconnect:', error);
      }
    }
  }
  
  /**
   * Terminate session (kill switch)
   */
  async terminateSession(sessionId, reason = 'Terminated by owner') {
    try {
      const session = await Session.findOne({ sessionId });
      
      if (!session) {
        console.error('Session not found for termination:', sessionId);
        return;
      }
      
      await session.endSession('killed');
      await session.addActivity('session_killed', { reason });
      
      // Notify client via Socket.IO
      const sessionInfo = this.activeSessions.get(sessionId);
      if (sessionInfo && global.io) {
        global.io.to(sessionInfo.socketId).emit('session-terminated', {
          reason,
          message: 'Your session has been terminated'
        });
      }
      
      // Clean up
      if (sessionInfo) {
        this.connections.delete(sessionInfo.socketId);
        this.activeSessions.delete(sessionId);
      }
      
      console.log(`🔴 Session terminated: ${sessionId} - Reason: ${reason}`);
    } catch (error) {
      console.error('Error terminating session:', error);
    }
  }
  
  /**
   * Clean up stale sessions (no heartbeat in 30 seconds)
   */
  async cleanupStaleSessions() {
    const staleThreshold = new Date(Date.now() - 30000); // 30 seconds
    
    for (const [sessionId, sessionInfo] of this.activeSessions) {
      if (sessionInfo.lastHeartbeat < staleThreshold) {
        console.log(`🧹 Cleaning up stale session: ${sessionId}`);
        
        try {
          const session = await Session.findOne({ sessionId, status: 'active' });
          if (session) {
            await session.endSession('timeout');
          }
        } catch (error) {
          console.error('Error cleaning up stale session:', error);
        }
        
        if (sessionInfo.socketId) {
          this.connections.delete(sessionInfo.socketId);
        }
        this.activeSessions.delete(sessionId);
      }
    }
  }
  
  /**
   * Get active session count
   */
  getActiveSessionCount() {
    return this.activeSessions.size;
  }
  
  /**
   * Get all active sessions
   */
  getActiveSessions() {
    return Array.from(this.activeSessions.entries()).map(([sessionId, info]) => ({
      sessionId,
      socketId: info.socketId,
      lastHeartbeat: info.lastHeartbeat,
      data: info.data
    }));
  }
  
  /**
   * Check if session is active
   */
  isSessionActive(sessionId) {
    return this.activeSessions.has(sessionId);
  }
}

module.exports = new SessionManager();
