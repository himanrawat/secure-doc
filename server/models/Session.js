const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  documentId: {
    type: String,
    required: true,
    index: true
  },
  userId: {
    type: String,
    required: false, // Not required for public viewer sessions
    index: true
  },
  viewerType: {
    type: String,
    enum: ['owner', 'viewer'],
    default: 'viewer'
  },
  viewerEmail: {
    type: String,
    default: null
  },
  shareToken: {
    type: String,
    default: null,
    index: true
  },
  deviceFingerprint: {
    type: String,
    required: true
  },
  ipAddress: {
    type: String,
    required: true
  },
  userAgent: {
    type: String,
    required: true
  },
  startTime: {
    type: Date,
    default: Date.now
  },
  endTime: {
    type: Date,
    default: null
  },
  lastHeartbeat: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['active', 'ended', 'killed', 'violated'],
    default: 'active'
  },
  cameraVerification: {
    initialCapture: {
      type: String, // Base64 image
      default: null
    },
    faceDescriptor: {
      type: Array,
      default: null
    },
    verified: {
      type: Boolean,
      default: false
    },
    lastVerification: {
      type: Date,
      default: null
    },
    verificationCount: {
      type: Number,
      default: 0
    }
  },
  violations: [{
    type: {
      type: String,
      enum: [
        'screenshot_attempt',
        'screen_recording_detected',
        'screen_sharing_detected',
        'devtools_opened',
        'focus_lost',
        'camera_obstruction',
        'external_camera_detected',
        'face_mismatch',
        'multiple_persons',
        'multiple_monitors',
        'concurrent_session',
        'copy_attempt',
        'print_attempt',
        'download_attempt',
        'tab_switch',
        'environment_change',
        'liveness_failed',
        'eye_tracking_failed'
      ]
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    evidence: {
      screenshot: String,
      cameraSnapshot: String,
      metadata: mongoose.Schema.Types.Mixed
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    }
  }],
  activityLog: [{
    action: {
      type: String,
      enum: [
        'document_opened',
        'document_closed',
        'page_changed',
        'zoom_changed',
        'scroll',
        'camera_verified',
        'focus_lost',
        'focus_gained',
        'violation_detected',
        'session_killed'
      ]
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    metadata: mongoose.Schema.Types.Mixed
  }],
  analytics: {
    totalTimeSpent: {
      type: Number,
      default: 0 // seconds
    },
    pagesViewed: [{
      pageNumber: Number,
      timeSpent: Number,
      visits: Number
    }],
    scrollDepth: {
      type: Number,
      default: 0 // percentage
    },
    averageAttentionScore: {
      type: Number,
      default: 0 // 0-100
    },
    blinkCount: {
      type: Number,
      default: 0
    },
    eyeTrackingData: [{
      timestamp: Date,
      gazeX: Number,
      gazeY: Number,
      attentionScore: Number
    }]
  },
  securityMetrics: {
    cameraObstructionAttempts: {
      type: Number,
      default: 0
    },
    externalCameraDetections: {
      type: Number,
      default: 0
    },
    faceMismatchCount: {
      type: Number,
      default: 0
    },
    screenshotAttempts: {
      type: Number,
      default: 0
    },
    focusLossCount: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

// Indexes
sessionSchema.index({ documentId: 1, status: 1 });
sessionSchema.index({ userId: 1, startTime: -1 });
sessionSchema.index({ status: 1, lastHeartbeat: 1 });

// Methods
sessionSchema.methods.addViolation = async function(violationType, evidence, severity = 'medium') {
  this.violations.push({
    type: violationType,
    timestamp: new Date(),
    evidence,
    severity
  });
  
  // Update security metrics
  switch(violationType) {
    case 'camera_obstruction':
      this.securityMetrics.cameraObstructionAttempts += 1;
      break;
    case 'external_camera_detected':
      this.securityMetrics.externalCameraDetections += 1;
      break;
    case 'face_mismatch':
      this.securityMetrics.faceMismatchCount += 1;
      break;
    case 'screenshot_attempt':
      this.securityMetrics.screenshotAttempts += 1;
      break;
    case 'focus_lost':
      this.securityMetrics.focusLossCount += 1;
      break;
  }
  
  await this.save();
  return this.violations.length;
};

sessionSchema.methods.addActivity = async function(action, metadata = {}) {
  this.activityLog.push({
    action,
    timestamp: new Date(),
    metadata
  });
  await this.save();
};

sessionSchema.methods.updateHeartbeat = async function(data = {}) {
  this.lastHeartbeat = new Date();
  
  // Update analytics if provided
  if (data.currentPage) {
    const pageIndex = this.analytics.pagesViewed.findIndex(p => p.pageNumber === data.currentPage);
    if (pageIndex === -1) {
      this.analytics.pagesViewed.push({
        pageNumber: data.currentPage,
        timeSpent: 5,
        visits: 1
      });
    } else {
      this.analytics.pagesViewed[pageIndex].timeSpent += 5;
    }
  }
  
  if (data.scrollDepth) {
    this.analytics.scrollDepth = Math.max(this.analytics.scrollDepth, data.scrollDepth);
  }
  
  if (data.attentionScore) {
    const currentAvg = this.analytics.averageAttentionScore;
    const count = this.analytics.eyeTrackingData.length || 1;
    this.analytics.averageAttentionScore = (currentAvg * count + data.attentionScore) / (count + 1);
  }
  
  this.analytics.totalTimeSpent += 5; // 5 second heartbeat interval
  
  await this.save();
};

sessionSchema.methods.endSession = async function(reason = 'normal') {
  this.endTime = new Date();
  this.status = reason === 'violated' ? 'violated' : (reason === 'killed' ? 'killed' : 'ended');
  await this.save();
};

module.exports = mongoose.model('Session', sessionSchema);
