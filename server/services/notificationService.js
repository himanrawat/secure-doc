const nodemailer = require('nodemailer');
const axios = require('axios');
const User = require('../models/User');

class NotificationService {
  constructor() {
    // Email transporter
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
      }
    });
  }
  
  /**
   * Notify owner of violation
   */
  async notifyViolation(ownerId, violationData) {
    try {
      const user = await User.findOne({ userId: ownerId });
      
      if (!user) {
        console.error('User not found for notification:', ownerId);
        return;
      }
      
      const {
        documentId,
        documentTitle,
        userId,
        violationType,
        violationCount,
        maxViolations,
        sessionId,
        evidence
      } = violationData;
      
      // Send email notification if enabled
      if (user.preferences.emailNotifications && user.preferences.notifyOnViolation) {
        await this.sendViolationEmail(user.email, {
          documentTitle,
          violationType,
          violationCount,
          maxViolations,
          timestamp: new Date().toISOString()
        });
      }
      
      // Send webhook notification if enabled
      if (user.preferences.webhookNotifications && process.env.WEBHOOK_URL) {
        await this.sendWebhook({
          event: 'violation_detected',
          documentId,
          documentTitle,
          userId,
          ownerId,
          violationType,
          violationCount,
          maxViolations,
          sessionId,
          timestamp: new Date().toISOString(),
          evidence: {
            hasScreenshot: !!evidence?.screenshot,
            hasCameraSnapshot: !!evidence?.cameraSnapshot,
            metadata: evidence?.metadata
          }
        });
      }
      
      // Real-time notification via Socket.IO
      if (global.io) {
        global.io.to(`dashboard-${ownerId}`).emit('violation-notification', {
          documentId,
          documentTitle,
          violationType,
          violationCount,
          maxViolations,
          timestamp: new Date()
        });
      }
    } catch (error) {
      console.error('Error sending violation notification:', error);
    }
  }
  
  /**
   * Notify owner of document access
   */
  async notifyAccess(ownerId, accessData) {
    try {
      const user = await User.findOne({ userId: ownerId });
      
      if (!user || !user.preferences.notifyOnAccess) {
        return;
      }
      
      const { documentId, documentTitle, userId, sessionId } = accessData;
      
      if (user.preferences.emailNotifications) {
        await this.sendAccessEmail(user.email, {
          documentTitle,
          timestamp: new Date().toISOString()
        });
      }
      
      if (user.preferences.webhookNotifications && process.env.WEBHOOK_URL) {
        await this.sendWebhook({
          event: 'document_accessed',
          documentId,
          documentTitle,
          userId,
          ownerId,
          sessionId,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error sending access notification:', error);
    }
  }
  
  /**
   * Send violation email
   */
  async sendViolationEmail(to, data) {
    try {
      const { documentTitle, violationType, violationCount, maxViolations, timestamp } = data;
      
      const subject = `🚨 Security Violation Detected - ${documentTitle}`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #d32f2f;">Security Violation Detected</h2>
          <p>A security violation has been detected while someone was viewing your document.</p>
          
          <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Document:</strong> ${documentTitle}</p>
            <p><strong>Violation Type:</strong> ${violationType.replace(/_/g, ' ').toUpperCase()}</p>
            <p><strong>Violations:</strong> ${violationCount} / ${maxViolations}</p>
            <p><strong>Time:</strong> ${new Date(timestamp).toLocaleString()}</p>
          </div>
          
          ${violationCount >= maxViolations ? `
            <div style="background: #ffebee; padding: 15px; border-radius: 5px; border-left: 4px solid #d32f2f;">
              <p style="margin: 0; color: #d32f2f;"><strong>⚠️ Session Terminated</strong></p>
              <p style="margin: 5px 0 0 0;">Maximum violation count reached. The viewing session has been terminated.</p>
            </div>
          ` : `
            <div style="background: #fff3e0; padding: 15px; border-radius: 5px; border-left: 4px solid #ff9800;">
              <p style="margin: 0; color: #e65100;"><strong>⚠️ Warning</strong></p>
              <p style="margin: 5px 0 0 0;">${maxViolations - violationCount} violation(s) remaining before session termination.</p>
            </div>
          `}
          
          <p style="margin-top: 20px;">
            <a href="${process.env.CLIENT_URL}/dashboard" style="background: #1976d2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
              View Dashboard
            </a>
          </p>
          
          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            This is an automated notification from Secure Document Viewer Platform.
          </p>
        </div>
      `;
      
      await this.transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to,
        subject,
        html
      });
    } catch (error) {
      console.error('Error sending violation email:', error);
    }
  }
  
  /**
   * Send access notification email
   */
  async sendAccessEmail(to, data) {
    try {
      const { documentTitle, timestamp } = data;
      
      const subject = `📄 Document Accessed - ${documentTitle}`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1976d2;">Document Accessed</h2>
          <p>Your document has been accessed.</p>
          
          <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Document:</strong> ${documentTitle}</p>
            <p><strong>Time:</strong> ${new Date(timestamp).toLocaleString()}</p>
          </div>
          
          <p>
            <a href="${process.env.CLIENT_URL}/dashboard" style="background: #1976d2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
              View Dashboard
            </a>
          </p>
        </div>
      `;
      
      await this.transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to,
        subject,
        html
      });
    } catch (error) {
      console.error('Error sending access email:', error);
    }
  }
  
  /**
   * Send webhook notification
   */
  async sendWebhook(data) {
    try {
      const webhookUrl = process.env.WEBHOOK_URL;
      
      if (!webhookUrl) {
        return;
      }
      
      const signature = require('crypto')
        .createHmac('sha256', process.env.WEBHOOK_SECRET || '')
        .update(JSON.stringify(data))
        .digest('hex');
      
      await axios.post(webhookUrl, data, {
        headers: {
          'Content-Type': 'application/json',
          'X-Signature': signature,
          'X-Event-Type': data.event
        },
        timeout: 5000
      });
    } catch (error) {
      console.error('Error sending webhook:', error.message);
    }
  }
}

module.exports = new NotificationService();
