const express = require('express');
const router = express.Router();
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const Document = require('../models/Document');
const Session = require('../models/Session');
const { authMiddleware, requireRole } = require('../middleware/auth');
const encryptionService = require('../services/encryptionService');

// Configure multer for file upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 104857600 // 100MB
  },
  fileFilter: (req, file, cb) => {
    // Allow PDF, images, and office documents
    const allowedMimes = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/jpg',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, images, and office documents are allowed.'));
    }
  }
});

// Upload document
router.post('/upload', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const {
      title,
      permissions = {},
      watermarkText = '',
      watermarkPosition = 'diagonal'
    } = req.body;
    
    // Parse permissions if it's a string
    const parsedPermissions = typeof permissions === 'string' 
      ? JSON.parse(permissions) 
      : permissions;
    
    // Generate document ID
    const documentId = uuidv4();
    
    // Generate encryption key for this document
    const documentKey = crypto.randomBytes(32);
    
    // Encrypt the file
    const encryptedData = encryptionService.encryptFile(req.file.buffer, documentKey);
    
    // Create upload directory if it doesn't exist
    const uploadDir = path.join(__dirname, '../../uploads');
    await fs.mkdir(uploadDir, { recursive: true });
    
    // Save encrypted file
    const encryptedPath = path.join(uploadDir, `${documentId}.enc`);
    await fs.writeFile(encryptedPath, encryptedData);
    
    // Calculate cryptographic hash for integrity
    const hash = crypto.createHash('sha256');
    hash.update(req.file.buffer);
    const cryptographicHash = hash.digest('hex');
    
    // Encrypt the document key with master key (stored in env)
    const encryptedKey = encryptionService.encryptKey(documentKey);
    
    // Generate share token and URL
    const shareToken = crypto.randomBytes(32).toString('hex');
    const baseUrl = process.env.CLIENT_URL || `http://localhost:${process.env.PORT || 3000}`;
    const shareUrl = `${baseUrl}/view/${shareToken}`;
    
    // Create document record
    const document = new Document({
      documentId,
      ownerId: req.userId,
      title: title || req.file.originalname,
      originalFilename: req.file.originalname,
      encryptedPath,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      encryptionKey: encryptedKey,
      cryptographicHash,
      shareToken,
      shareUrl,
      permissions: {
        ...parsedPermissions,
        securityLevel: parsedPermissions.securityLevel || 'MEDIUM'
      },
      watermark: {
        visible: {
          enabled: true,
          text: watermarkText || `${req.user.name} - ${new Date().toISOString()}`,
          position: watermarkPosition,
          opacity: 0.3
        },
        forensic: {
          enabled: parsedPermissions.securityLevel === 'MAXIMUM',
          pattern: crypto.randomBytes(16).toString('hex')
        }
      }
    });
    
    await document.save();
    
    res.status(201).json({
      success: true,
      document: {
        documentId: document.documentId,
        title: document.title,
        filename: document.originalFilename,
        size: document.fileSize,
        mimeType: document.mimeType,
        permissions: document.permissions,
        shareUrl: document.shareUrl,
        shareToken: document.shareToken,
        createdAt: document.createdAt
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Error uploading document' });
  }
});

// Get document metadata
router.get('/:documentId', authMiddleware, async (req, res) => {
  try {
    const { documentId } = req.params;
    
    const document = await Document.findOne({ documentId });
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    // Check if user is owner or has access
    const isOwner = document.ownerId === req.userId;
    
    if (!isOwner) {
      // Check if user has permission to view
      const hasAccess = document.permissions.allowedEmails.includes(req.user.email);
      if (!hasAccess && document.permissions.allowedEmails.length > 0) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }
    
    res.json({
      success: true,
      document: {
        documentId: document.documentId,
        title: document.title,
        filename: document.originalFilename,
        size: document.fileSize,
        mimeType: document.mimeType,
        permissions: document.permissions,
        watermark: document.watermark,
        status: document.status,
        shareToken: document.shareToken,
        shareUrl: document.shareUrl,
        createdAt: document.createdAt,
        isOwner
      }
    });
  } catch (error) {
    console.error('Get document error:', error);
    res.status(500).json({ error: 'Error fetching document' });
  }
});

// Get document for viewing (returns encrypted content)
router.get('/:documentId/view', authMiddleware, async (req, res) => {
  try {
    const { documentId } = req.params;
    const { deviceFingerprint } = req.query;
    
    const document = await Document.findOne({ documentId });
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    // Check access permissions
    const ipAddress = req.ip || req.connection.remoteAddress;
    const accessCheck = document.canAccess(deviceFingerprint, ipAddress, req.user.email);
    
    if (!accessCheck.allowed) {
      return res.status(403).json({ error: accessCheck.reason });
    }
    
    // Check for concurrent sessions if enabled
    if (document.permissions.blockConcurrentSessions) {
      const activeSessions = await Session.find({
        documentId,
        status: 'active',
        lastHeartbeat: { $gt: new Date(Date.now() - 30000) } // Active in last 30 seconds
      });
      
      if (activeSessions.length > 0 && activeSessions[0].userId !== req.userId) {
        return res.status(423).json({ 
          error: 'Document is currently being viewed by another user',
          locked: true
        });
      }
    }
    
    // Increment view count
    await document.incrementViewCount();
    
    // Read encrypted file
    const encryptedData = await fs.readFile(document.encryptedPath);
    
    // Decrypt document key
    const documentKey = encryptionService.decryptKey(document.encryptionKey);
    
    // Decrypt file
    const decryptedData = encryptionService.decryptFile(encryptedData, documentKey);
    
    // Verify integrity
    const hash = crypto.createHash('sha256');
    hash.update(decryptedData);
    const calculatedHash = hash.digest('hex');
    
    if (calculatedHash !== document.cryptographicHash) {
      return res.status(500).json({ error: 'Document integrity check failed' });
    }
    
    // Create session
    const session = new Session({
      sessionId: uuidv4(),
      documentId,
      userId: req.userId,
      deviceFingerprint,
      ipAddress,
      userAgent: req.headers['user-agent']
    });
    
    await session.save();
    await session.addActivity('document_opened', { documentId, title: document.title });
    
    // Convert to base64 for transmission
    const base64Data = decryptedData.toString('base64');
    
    res.json({
      success: true,
      sessionId: session.sessionId,
      document: {
        documentId: document.documentId,
        title: document.title,
        mimeType: document.mimeType,
        data: base64Data,
        permissions: document.permissions,
        watermark: document.watermark
      }
    });
  } catch (error) {
    console.error('View document error:', error);
    res.status(500).json({ error: 'Error loading document' });
  }
});

// Get user's documents (owner only)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const documents = await Document.find({ 
      ownerId: req.userId,
      status: { $ne: 'deleted' }
    }).sort({ createdAt: -1 });
    
    res.json({
      success: true,
      documents: documents.map(doc => ({
        documentId: doc.documentId,
        title: doc.title,
        filename: doc.originalFilename,
        size: doc.fileSize,
        mimeType: doc.mimeType,
        permissions: doc.permissions,
        watermark: doc.watermark,
        status: doc.status,
        shareToken: doc.shareToken,
        shareUrl: doc.shareUrl,
        createdAt: doc.createdAt
      }))
    });
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({ error: 'Error fetching documents' });
  }
});

// Update document permissions
router.put('/:documentId/permissions', authMiddleware, async (req, res) => {
  try {
    const { documentId } = req.params;
    const { permissions } = req.body;
    
    const document = await Document.findOne({ documentId, ownerId: req.userId });
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found or access denied' });
    }
    
    document.permissions = { ...document.permissions, ...permissions };
    document.updatedAt = new Date();
    await document.save();
    
    res.json({
      success: true,
      permissions: document.permissions
    });
  } catch (error) {
    console.error('Update permissions error:', error);
    res.status(500).json({ error: 'Error updating permissions' });
  }
});

// Revoke access (Remote kill switch)
router.post('/:documentId/revoke', authMiddleware, async (req, res) => {
  try {
    const { documentId } = req.params;
    
    const document = await Document.findOne({ documentId, ownerId: req.userId });
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found or access denied' });
    }
    
    await document.revoke();
    
    // End all active sessions
    await Session.updateMany(
      { documentId, status: 'active' },
      { $set: { status: 'killed', endTime: new Date() } }
    );
    
    res.json({
      success: true,
      message: 'Document access revoked successfully'
    });
  } catch (error) {
    console.error('Revoke error:', error);
    res.status(500).json({ error: 'Error revoking access' });
  }
});

// Delete document
router.delete('/:documentId', authMiddleware, async (req, res) => {
  try {
    const { documentId } = req.params;
    
    const document = await Document.findOne({ documentId, ownerId: req.userId });
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found or access denied' });
    }
    
    // Delete encrypted file
    await fs.unlink(document.encryptedPath).catch(() => {});
    
    // Mark as deleted
    document.status = 'deleted';
    await document.save();
    
    // End all sessions
    await Session.updateMany(
      { documentId, status: 'active' },
      { $set: { status: 'killed', endTime: new Date() } }
    );
    
    res.json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ error: 'Error deleting document' });
  }
});

// Configure document security and generate share link
router.post('/:documentId/configure', authMiddleware, async (req, res) => {
  try {
    const { documentId } = req.params;
    const { permissions, watermark } = req.body;
    
    const document = await Document.findOne({ documentId, ownerId: req.userId });
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found or access denied' });
    }
    
    // Generate unique share token if not already exists
    if (!document.shareToken) {
      document.shareToken = crypto.randomBytes(32).toString('hex');
    }
    
    // Update permissions
    if (permissions) {
      document.permissions = {
        ...document.permissions,
        ...permissions
      };
    }
    
    // Update watermark settings
    if (watermark) {
      document.watermark = {
        ...document.watermark,
        ...watermark
      };
    }
    
    // Generate share URL
    const baseUrl = process.env.CLIENT_URL || `http://localhost:${process.env.PORT || 3000}`;
    document.shareUrl = `${baseUrl}/view/${document.shareToken}`;
    
    await document.save();
    
    res.json({
      success: true,
      message: 'Document configured successfully',
      shareToken: document.shareToken,
      shareUrl: document.shareUrl,
      document: {
        documentId: document.documentId,
        title: document.title,
        permissions: document.permissions,
        watermark: document.watermark
      }
    });
  } catch (error) {
    console.error('Configure document error:', error);
    res.status(500).json({ error: 'Error configuring document' });
  }
});

// Get document by share token (public access)
router.get('/share/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const deviceFingerprint = req.headers['x-device-fingerprint'];
    const ipAddress = req.ip || req.connection.remoteAddress;
    
    const document = await Document.findOne({ 
      shareToken: token,
      status: 'active'
    });
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found or access has been revoked' });
    }
    
    // Check access permissions
    const accessCheck = document.canAccess(deviceFingerprint, ipAddress, null);
    
    if (!accessCheck.allowed) {
      return res.status(403).json({ 
        error: 'Access denied',
        reason: accessCheck.reason
      });
    }
    
    // Return document metadata (not the actual file)
    res.json({
      documentId: document.documentId,
      title: document.title,
      mimeType: document.mimeType,
      fileSize: document.fileSize,
      permissions: document.permissions,
      watermark: document.watermark,
      currentViews: document.permissions.currentViews,
      maxViews: document.permissions.maxViews,
      expiryDate: document.permissions.expiryDate
    });
  } catch (error) {
    console.error('Get document by token error:', error);
    res.status(500).json({ error: 'Error loading document' });
  }
});

// View document content (public access with token)
router.get('/share/:token/content', async (req, res) => {
  try {
    const { token } = req.params;
    const deviceFingerprint = req.headers['x-device-fingerprint'];
    const ipAddress = req.ip || req.connection.remoteAddress;
    
    const document = await Document.findOne({ 
      shareToken: token,
      status: 'active'
    });
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    // Check access permissions
    const accessCheck = document.canAccess(deviceFingerprint, ipAddress, null);
    
    if (!accessCheck.allowed) {
      return res.status(403).json({ 
        error: 'Access denied',
        reason: accessCheck.reason
      });
    }
    
    // Increment view count
    await document.incrementViewCount();
    
    // Decrypt and serve file
    const encryptedData = await fs.readFile(document.encryptedPath);
    const decryptedData = encryptionService.decryptFile(
      encryptedData,
      document.encryptionKey
    );
    
    // Verify integrity
    const hash = crypto.createHash('sha256').update(decryptedData).digest('hex');
    if (hash !== document.cryptographicHash) {
      throw new Error('Document integrity check failed');
    }
    
    res.set({
      'Content-Type': document.mimeType,
      'Content-Disposition': `inline; filename="${document.originalFilename}"`,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'X-Content-Type-Options': 'nosniff'
    });
    
    res.send(decryptedData);
  } catch (error) {
    console.error('View document error:', error);
    res.status(500).json({ error: 'Error loading document content' });
  }
});

module.exports = router;
