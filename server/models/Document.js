const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  documentId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  ownerId: {
    type: String,
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true
  },
  originalFilename: {
    type: String,
    required: true
  },
  encryptedPath: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  encryptionKey: {
    type: String,
    required: true // Encrypted with master key
  },
  cryptographicHash: {
    type: String,
    required: true // For integrity verification
  },
  shareToken: {
    type: String,
    unique: true,
    sparse: true, // Allows null values
    index: true
  },
  shareUrl: {
    type: String,
    default: null
  },
  permissions: {
    maxViews: {
      type: Number,
      default: -1 // -1 = unlimited
    },
    currentViews: {
      type: Number,
      default: 0
    },
    expiryDate: {
      type: Date,
      default: null
    },
    allowedDevices: [{
      type: String
    }],
    allowedIPs: [{
      type: String
    }],
    allowedEmails: [{
      type: String
    }],
    securityLevel: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'MAXIMUM'],
      default: 'MEDIUM'
    },
    allowScreenshot: {
      type: Boolean,
      default: false
    },
    allowPrint: {
      type: Boolean,
      default: false
    },
    allowCopy: {
      type: Boolean,
      default: false
    },
    requireCamera: {
      type: Boolean,
      default: true
    },
    requireFaceMatch: {
      type: Boolean,
      default: false
    },
    allowedTimeStart: {
      type: String, // Format: "HH:MM" (e.g., "09:00")
      default: null
    },
    allowedTimeEnd: {
      type: String, // Format: "HH:MM" (e.g., "17:00")
      default: null
    },
    allowedDays: [{
      type: Number, // 0-6 (Sunday-Saturday)
    }],
    blockMultipleMonitors: {
      type: Boolean,
      default: false
    },
    blockConcurrentSessions: {
      type: Boolean,
      default: true
    },
    allowOfflineAccess: {
      type: Boolean,
      default: false
    },
    sessionTimeLimit: {
      type: Number,
      default: -1 // minutes, -1 = unlimited
    },
    maxViolations: {
      type: Number,
      default: 3
    }
  },
  watermark: {
    visible: {
      enabled: {
        type: Boolean,
        default: true
      },
      text: {
        type: String,
        default: ''
      },
      position: {
        type: String,
        enum: ['center', 'diagonal', 'corners', 'floating'],
        default: 'diagonal'
      },
      opacity: {
        type: Number,
        default: 0.3
      }
    },
    forensic: {
      enabled: {
        type: Boolean,
        default: false
      },
      pattern: {
        type: String,
        default: ''
      }
    }
  },
  status: {
    type: String,
    enum: ['active', 'revoked', 'expired', 'deleted'],
    default: 'active'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for performance
documentSchema.index({ ownerId: 1, createdAt: -1 });
documentSchema.index({ status: 1 });
documentSchema.index({ 'permissions.expiryDate': 1 });

// Methods
documentSchema.methods.canAccess = function(deviceFingerprint, ipAddress, email) {
  // Check status
  if (this.status !== 'active') return { allowed: false, reason: 'Document is not active' };
  
  // Check expiry
  if (this.permissions.expiryDate && new Date() > this.permissions.expiryDate) {
    return { allowed: false, reason: 'Document access has expired' };
  }
  
  // Check max views
  if (this.permissions.maxViews !== -1 && this.currentViews >= this.permissions.maxViews) {
    return { allowed: false, reason: 'Maximum view count reached' };
  }
  
  // Check device whitelist
  if (this.permissions.allowedDevices.length > 0 && 
      !this.permissions.allowedDevices.includes(deviceFingerprint)) {
    return { allowed: false, reason: 'Device not authorized' };
  }
  
  // Check IP whitelist
  if (this.permissions.allowedIPs.length > 0 && 
      !this.permissions.allowedIPs.includes(ipAddress)) {
    return { allowed: false, reason: 'IP address not authorized' };
  }
  
  // Check email whitelist
  if (this.permissions.allowedEmails.length > 0 && 
      !this.permissions.allowedEmails.includes(email)) {
    return { allowed: false, reason: 'Email not authorized' };
  }
  
  // Check time restrictions
  const now = new Date();
  const currentDay = now.getDay();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  
  if (this.permissions.allowedDays && this.permissions.allowedDays.length > 0 &&
      !this.permissions.allowedDays.includes(currentDay)) {
    return { allowed: false, reason: 'Access not allowed on this day' };
  }
  
  if (this.permissions.allowedTimeStart && this.permissions.allowedTimeEnd) {
    if (currentTime < this.permissions.allowedTimeStart || currentTime > this.permissions.allowedTimeEnd) {
      return { allowed: false, reason: 'Access not allowed at this time' };
    }
  }
  
  return { allowed: true };
};

documentSchema.methods.incrementViewCount = async function() {
  this.permissions.currentViews += 1;
  await this.save();
};

documentSchema.methods.revoke = async function() {
  this.status = 'revoked';
  this.updatedAt = new Date();
  await this.save();
  
  // Notify all active sessions via Socket.IO
  if (global.io) {
    global.io.to(`document-${this.documentId}`).emit('document-revoked', {
      documentId: this.documentId,
      message: 'Access has been revoked by the owner'
    });
  }
};

module.exports = mongoose.model('Document', documentSchema);
