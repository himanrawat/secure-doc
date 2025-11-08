const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  passwordHash: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['owner', 'viewer', 'admin'],
    default: 'viewer'
  },
  faceDescriptor: {
    type: Array,
    default: null // Stored face embedding for verification
  },
  devices: [{
    fingerprint: String,
    name: String,
    lastUsed: Date,
    trusted: Boolean
  }],
  preferences: {
    notifyOnViolation: {
      type: Boolean,
      default: true
    },
    notifyOnAccess: {
      type: Boolean,
      default: false
    },
    emailNotifications: {
      type: Boolean,
      default: true
    },
    webhookNotifications: {
      type: Boolean,
      default: false
    }
  },
  status: {
    type: String,
    enum: ['active', 'suspended', 'deleted'],
    default: 'active'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

userSchema.methods.addDevice = async function(fingerprint, name) {
  const existingDevice = this.devices.find(d => d.fingerprint === fingerprint);
  if (!existingDevice) {
    this.devices.push({
      fingerprint,
      name,
      lastUsed: new Date(),
      trusted: false
    });
    await this.save();
  }
};

userSchema.methods.updateLastLogin = async function() {
  this.lastLogin = new Date();
  await this.save();
};

module.exports = mongoose.model('User', userSchema);
