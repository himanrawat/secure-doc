const express = require('express');
const router = express.Router();
const Document = require('../models/Document');
const { authMiddleware } = require('../middleware/auth');

// Get document permissions
router.get('/:documentId', authMiddleware, async (req, res) => {
  try {
    const { documentId } = req.params;
    
    const document = await Document.findOne({ documentId });
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    // Only owner can view full permissions
    if (document.ownerId !== req.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    res.json({
      success: true,
      permissions: document.permissions
    });
  } catch (error) {
    console.error('Get permissions error:', error);
    res.status(500).json({ error: 'Error fetching permissions' });
  }
});

// Update permissions
router.put('/:documentId', authMiddleware, async (req, res) => {
  try {
    const { documentId } = req.params;
    const { permissions } = req.body;
    
    const document = await Document.findOne({ documentId, ownerId: req.userId });
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found or access denied' });
    }
    
    // Merge permissions
    document.permissions = {
      ...document.permissions,
      ...permissions
    };
    
    document.updatedAt = new Date();
    await document.save();
    
    // Notify active sessions of permission changes
    if (global.io) {
      global.io.to(`document-${documentId}`).emit('permissions-updated', {
        documentId,
        permissions: document.permissions
      });
    }
    
    res.json({
      success: true,
      permissions: document.permissions
    });
  } catch (error) {
    console.error('Update permissions error:', error);
    res.status(500).json({ error: 'Error updating permissions' });
  }
});

// Add allowed email
router.post('/:documentId/allowed-emails', authMiddleware, async (req, res) => {
  try {
    const { documentId } = req.params;
    const { email } = req.body;
    
    const document = await Document.findOne({ documentId, ownerId: req.userId });
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found or access denied' });
    }
    
    if (!document.permissions.allowedEmails.includes(email)) {
      document.permissions.allowedEmails.push(email);
      await document.save();
    }
    
    res.json({
      success: true,
      allowedEmails: document.permissions.allowedEmails
    });
  } catch (error) {
    console.error('Add allowed email error:', error);
    res.status(500).json({ error: 'Error adding allowed email' });
  }
});

// Remove allowed email
router.delete('/:documentId/allowed-emails/:email', authMiddleware, async (req, res) => {
  try {
    const { documentId, email } = req.params;
    
    const document = await Document.findOne({ documentId, ownerId: req.userId });
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found or access denied' });
    }
    
    document.permissions.allowedEmails = document.permissions.allowedEmails.filter(
      e => e !== decodeURIComponent(email)
    );
    await document.save();
    
    res.json({
      success: true,
      allowedEmails: document.permissions.allowedEmails
    });
  } catch (error) {
    console.error('Remove allowed email error:', error);
    res.status(500).json({ error: 'Error removing allowed email' });
  }
});

module.exports = router;
