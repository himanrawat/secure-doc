/**
 * Dashboard Main Script
 * Real-time monitoring and document management interface
 */

(function() {
  'use strict';
  
  const API_BASE = '/api';
  const TOKEN = localStorage.getItem('authToken');
  
  if (!TOKEN) {
    window.location.href = '/login.html';
    return;
  }
  
  let socket = null;
  let charts = {};
  
  // Initialize
  async function initialize() {
    console.log('🚀 Initializing dashboard...');
    
    try {
      // Load user info
      await loadUserInfo();
      
      // Initialize Socket.IO
      initializeSocket();
      
      // Load overview data
      await loadOverview();
      
      // Setup navigation
      setupNavigation();
      
      // Setup upload form
      setupUploadForm();
      
    } catch (err) {
      console.error('Initialization error:', err);
      if (err.message.includes('401') || err.message.includes('Unauthorized')) {
        localStorage.removeItem('authToken');
        window.location.href = '/login.html';
      }
    }
  }
  
  async function loadUserInfo() {
    const response = await fetch(`${API_BASE}/auth/me`, {
      headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    
    if (!response.ok) throw new Error('Failed to load user info');
    
    const user = await response.json();
    document.getElementById('user-name').textContent = user.name;
    document.getElementById('user-email').textContent = user.email;
    
    localStorage.setItem('userName', user.name);
    localStorage.setItem('userEmail', user.email);
  }
  
  function initializeSocket() {
    socket = io({ auth: { token: TOKEN } });
    
    socket.on('connect', () => {
      console.log('🔌 Socket connected');
      socket.emit('join-dashboard');
    });
    
    socket.on('session-started', (data) => {
      console.log('📊 New session started:', data);
      updateActiveSessions();
      addActivityItem(`New session started for "${data.documentTitle}"`, 'info');
    });
    
    socket.on('session-ended', (data) => {
      console.log('📊 Session ended:', data);
      updateActiveSessions();
      addActivityItem(`Session ended for "${data.documentTitle}"`, 'info');
    });
    
    socket.on('violation-detected', (data) => {
      console.log('⚠️ Violation detected:', data);
      updateViolationStats();
      addActivityItem(`Violation: ${data.type} on "${data.documentTitle}"`, 'warning');
      showNotification(`Security violation detected: ${data.type}`, 'warning');
    });
    
    socket.on('disconnect', () => {
      console.log('🔌 Socket disconnected');
    });
  }
  
  async function loadOverview() {
    try {
      // Load stats
      const [docsRes, sessionsRes, violationsRes] = await Promise.all([
        fetch(`${API_BASE}/documents`, { headers: { 'Authorization': `Bearer ${TOKEN}` } }),
        fetch(`${API_BASE}/dashboard/sessions/live`, { headers: { 'Authorization': `Bearer ${TOKEN}` } }),
        fetch(`${API_BASE}/dashboard/violations`, { headers: { 'Authorization': `Bearer ${TOKEN}` } })
      ]);
      
      const documents = await docsRes.json();
      const sessions = await sessionsRes.json();
      const violations = await violationsRes.json();
      
      // Extract arrays from API responses
      const docsList = documents.documents || documents;
      const sessionsList = sessions.sessions || sessions;
      const violationsList = violations.violations || violations;
      
      // Update stats
      document.getElementById('total-documents').textContent = docsList.length;
      document.getElementById('active-sessions').textContent = sessionsList.length;
      document.getElementById('total-violations').textContent = violationsList.length;
      
      const totalViews = docsList.reduce((sum, doc) => sum + (doc.viewCount || 0), 0);
      document.getElementById('total-views').textContent = totalViews;
      
      // Initialize charts
      initializeCharts(violationsList);
      
      // Load activity
      await loadActivity();
      
    } catch (err) {
      console.error('Failed to load overview:', err);
    }
  }
  
  function initializeCharts(violations) {
    // Violations over time chart
    const violationsCtx = document.getElementById('violations-chart');
    if (violationsCtx) {
      const last7Days = getLast7Days();
      const violationsByDay = countViolationsByDay(violations, last7Days);
      
      charts.violations = new Chart(violationsCtx, {
        type: 'line',
        data: {
          labels: last7Days.map(d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
          datasets: [{
            label: 'Violations',
            data: violationsByDay,
            borderColor: '#dc3545',
            backgroundColor: 'rgba(220, 53, 69, 0.1)',
            tension: 0.4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          }
        }
      });
    }
    
    // Activity chart
    const activityCtx = document.getElementById('activity-chart');
    if (activityCtx) {
      charts.activity = new Chart(activityCtx, {
        type: 'bar',
        data: {
          labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          datasets: [{
            label: 'Sessions',
            data: [12, 19, 15, 25, 22, 18, 20],
            backgroundColor: 'rgba(0, 102, 204, 0.5)',
            borderColor: '#0066cc',
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          }
        }
      });
    }
  }
  
  function getLast7Days() {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      days.push(date);
    }
    return days;
  }
  
  function countViolationsByDay(violations, days) {
    return days.map(day => {
      const nextDay = new Date(day);
      nextDay.setDate(nextDay.getDate() + 1);
      
      return violations.filter(v => {
        const vDate = new Date(v.timestamp);
        return vDate >= day && vDate < nextDay;
      }).length;
    });
  }
  
  async function loadActivity() {
    try {
      const response = await fetch(`${API_BASE}/dashboard/logs?limit=10`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` }
      });
      
      const logs = await response.json();
      const container = document.getElementById('recent-activity-list');
      
      container.innerHTML = logs.map(log => `
        <div class="activity-item">
          <div class="activity-icon">${getActivityIcon(log.action)}</div>
          <div class="activity-details">
            <div class="activity-text">${formatActivity(log)}</div>
            <div class="activity-time">${formatTimeAgo(log.timestamp)}</div>
          </div>
        </div>
      `).join('');
      
    } catch (err) {
      console.error('Failed to load activity:', err);
    }
  }
  
  function getActivityIcon(action) {
    const icons = {
      'session_started': '🟢',
      'session_ended': '🔴',
      'violation_detected': '⚠️',
      'document_uploaded': '📤',
      'document_revoked': '🚫',
      'camera_verified': '📷'
    };
    return icons[action] || '📋';
  }
  
  function formatActivity(log) {
    const actions = {
      'session_started': `New viewing session started`,
      'session_ended': `Viewing session ended`,
      'violation_detected': `Security violation: ${log.details?.type}`,
      'document_uploaded': `Document uploaded: ${log.details?.title}`,
      'document_revoked': `Document access revoked`,
      'camera_verified': `Camera verification successful`
    };
    return actions[log.action] || log.action;
  }
  
  function formatTimeAgo(timestamp) {
    const seconds = Math.floor((new Date() - new Date(timestamp)) / 1000);
    
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }
  
  async function updateActiveSessions() {
    try {
      const response = await fetch(`${API_BASE}/dashboard/sessions/live`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` }
      });
      
      const sessions = await response.json();
      document.getElementById('active-sessions').textContent = sessions.length;
      
    } catch (err) {
      console.error('Failed to update sessions:', err);
    }
  }
  
  async function updateViolationStats() {
    try {
      const response = await fetch(`${API_BASE}/dashboard/violations`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` }
      });
      
      const violations = await response.json();
      document.getElementById('total-violations').textContent = violations.length;
      
    } catch (err) {
      console.error('Failed to update violations:', err);
    }
  }
  
  function addActivityItem(text, type) {
    const container = document.getElementById('recent-activity-list');
    const icon = type === 'warning' ? '⚠️' : '📋';
    
    const item = document.createElement('div');
    item.className = 'activity-item';
    item.innerHTML = `
      <div class="activity-icon">${icon}</div>
      <div class="activity-details">
        <div class="activity-text">${text}</div>
        <div class="activity-time">just now</div>
      </div>
    `;
    
    container.insertBefore(item, container.firstChild);
    
    // Keep only last 10
    while (container.children.length > 10) {
      container.removeChild(container.lastChild);
    }
  }
  
  function showNotification(message, type = 'info') {
    // Simple notification (could be enhanced with a library)
    console.log(`[${type.toUpperCase()}] ${message}`);
  }
  
  function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.content-section');
    
    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        
        const sectionId = item.dataset.section;
        
        // Update active nav
        navItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        
        // Show section
        sections.forEach(s => s.classList.remove('active'));
        document.getElementById(`${sectionId}-section`).classList.add('active');
        
        // Load section data
        loadSectionData(sectionId);
      });
    });
  }
  
  async function loadSectionData(section) {
    switch (section) {
      case 'documents':
        await loadDocuments();
        break;
      case 'sessions':
        await loadSessions();
        break;
      case 'violations':
        await loadViolations();
        break;
      case 'analytics':
        await loadAnalytics();
        break;
    }
  }
  
  async function loadDocuments() {
    try {
      const response = await fetch(`${API_BASE}/documents`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` }
      });
      
      const data = await response.json();
      const documents = data.documents || data;
      const container = document.getElementById('documents-list');
      
      if (documents.length === 0) {
        container.innerHTML = '<div class="empty-state">No documents yet. Upload your first document!</div>';
        return;
      }
      
      container.innerHTML = documents.map(doc => `
        <div class="document-card">
          <div class="document-icon">${getFileIcon(doc.mimeType)}</div>
          <h4>${doc.title}</h4>
          <p class="text-muted">${doc.mimeType}</p>
          <div class="document-stats">
            <span>👁️ ${doc.permissions?.currentViews || 0} views</span>
            <span>🔒 ${doc.permissions?.securityLevel || 'MEDIUM'}</span>
            ${doc.shareUrl ? '<span style="color: #4caf50;">✓ Shared</span>' : '<span style="color: #999;">Not shared</span>'}
          </div>
          <div class="document-actions">
            <button class="btn-icon" onclick="viewDocument('${doc.documentId}')" title="View">👁️</button>
            ${doc.shareUrl 
              ? `<button class="btn-icon" onclick="copyShareLink('${doc.documentId}', '${doc.shareUrl}')" title="Copy Share Link" style="background: #4caf50; color: white;">🔗</button>`
              : `<button class="btn-icon" onclick="configureDocument('${doc.documentId}')" title="Generate Share Link">⚙️</button>`
            }
            <button class="btn-icon" onclick="configureDocument('${doc.documentId}')" title="Edit Settings">✏️</button>
            <button class="btn-icon" onclick="revokeDocument('${doc.documentId}')" title="Revoke">🚫</button>
          </div>
        </div>
      `).join('');
      
    } catch (err) {
      console.error('Failed to load documents:', err);
    }
  }
  
  function getFileIcon(mimeType) {
    if (mimeType.includes('pdf')) return '📕';
    if (mimeType.includes('image')) return '🖼️';
    if (mimeType.includes('text')) return '📄';
    return '📎';
  }
  
  async function loadSessions() {
    try {
      const response = await fetch(`${API_BASE}/dashboard/sessions/live`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` }
      });
      
      const sessions = await response.json();
      const container = document.getElementById('sessions-list');
      
      if (sessions.length === 0) {
        container.innerHTML = '<div class="empty-state">No active sessions</div>';
        return;
      }
      
      container.innerHTML = sessions.map(session => `
        <div class="session-card">
          <div class="session-header">
            <h4>${session.document.title}</h4>
            <span class="session-status active">● Live</span>
          </div>
          <div class="session-info">
            <p><strong>User:</strong> ${session.user.name}</p>
            <p><strong>Started:</strong> ${formatTimeAgo(session.startTime)}</p>
            <p><strong>Violations:</strong> ${session.violations.length}</p>
          </div>
          <button class="btn-danger btn-small" onclick="terminateSession('${session._id}')">
            🚫 Terminate
          </button>
        </div>
      `).join('');
      
    } catch (err) {
      console.error('Failed to load sessions:', err);
    }
  }
  
  async function loadViolations() {
    try {
      const response = await fetch(`${API_BASE}/dashboard/violations`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` }
      });
      
      const violations = await response.json();
      const container = document.getElementById('violations-list');
      
      container.innerHTML = `
        <table class="data-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Type</th>
              <th>Document</th>
              <th>User</th>
              <th>Severity</th>
            </tr>
          </thead>
          <tbody>
            ${violations.map(v => `
              <tr>
                <td>${new Date(v.timestamp).toLocaleString()}</td>
                <td>${v.type}</td>
                <td>${v.documentTitle || 'Unknown'}</td>
                <td>${v.userName || 'Unknown'}</td>
                <td><span class="badge badge-${v.severity}">${v.severity}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      
    } catch (err) {
      console.error('Failed to load violations:', err);
    }
  }
  
  async function loadAnalytics() {
    // Placeholder for analytics
    console.log('Loading analytics...');
  }
  
  function setupUploadForm() {
    const form = document.getElementById('upload-form');
    const fileInput = document.getElementById('file-input');
    const browseBtn = document.getElementById('browse-btn');
    const uploadArea = document.getElementById('upload-area');
    const filePreview = document.getElementById('file-preview');
    const watermarkCheckbox = document.getElementById('watermark-enabled');
    const watermarkOptions = document.getElementById('watermark-options');
    
    browseBtn.addEventListener('click', () => fileInput.click());
    
    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        showFilePreview(e.target.files[0]);
      }
    });
    
    uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadArea.classList.add('drag-over');
    });
    
    uploadArea.addEventListener('dragleave', () => {
      uploadArea.classList.remove('drag-over');
    });
    
    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.classList.remove('drag-over');
      
      if (e.dataTransfer.files.length > 0) {
        fileInput.files = e.dataTransfer.files;
        showFilePreview(e.dataTransfer.files[0]);
      }
    });
    
    watermarkCheckbox.addEventListener('change', (e) => {
      watermarkOptions.classList.toggle('hidden', !e.target.checked);
    });
    
    form.addEventListener('submit', handleUpload);
  }
  
  function showFilePreview(file) {
    document.getElementById('upload-area').classList.add('hidden');
    document.getElementById('file-preview').classList.remove('hidden');
    document.getElementById('file-name').textContent = file.name;
    document.getElementById('file-size').textContent = formatFileSize(file.size);
  }
  
  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / 1048576).toFixed(2) + ' MB';
  }
  
  async function handleUpload(e) {
    e.preventDefault();
    
    const fileInput = document.getElementById('file-input');
    if (!fileInput.files.length) {
      alert('Please select a file');
      return;
    }
    
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    formData.append('title', document.getElementById('doc-title').value);
    formData.append('description', document.getElementById('doc-description').value);
    
    const permissions = {
      securityLevel: document.getElementById('security-level').value,
      maxViews: document.getElementById('max-views').value || null,
      expiryDate: document.getElementById('expiry-date').value || null,
      blockScreenshots: document.getElementById('block-screenshots').checked,
      blockPrinting: document.getElementById('block-printing').checked,
      blockCopyPaste: document.getElementById('block-copy-paste').checked,
      requireCameraVerification: document.getElementById('require-camera').checked
    };
    
    formData.append('permissions', JSON.stringify(permissions));
    
    if (document.getElementById('watermark-enabled').checked) {
      const watermark = {
        visible: true,
        text: document.getElementById('watermark-text').value,
        position: document.getElementById('watermark-position').value,
        opacity: parseFloat(document.getElementById('watermark-opacity').value)
      };
      formData.append('watermark', JSON.stringify(watermark));
    }
    
    try {
      const response = await fetch(`${API_BASE}/documents/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${TOKEN}` },
        body: formData
      });
      
      if (!response.ok) throw new Error('Upload failed');
      
      const result = await response.json();
      alert('Document uploaded successfully!');
      
      // Reset form
      e.target.reset();
      document.getElementById('upload-area').classList.remove('hidden');
      document.getElementById('file-preview').classList.add('hidden');
      
    } catch (err) {
      console.error('Upload error:', err);
      alert('Upload failed: ' + err.message);
    }
  }
  
  // Global functions for inline handlers
  window.viewDocument = (id) => {
    window.open(`/viewer.html?id=${id}`, '_blank');
  };
  
  window.configureDocument = (id) => {
    window.location.href = `/configure-document.html?id=${id}`;
  };

  window.copyShareLink = async (id, shareUrl) => {
    if (!shareUrl) {
      alert('❌ This document does not have a share link yet. Please configure it first.');
      return;
    }
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert('✅ Share link copied to clipboard!\n\n' + shareUrl);
    } catch (err) {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = shareUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      alert('✅ Share link copied to clipboard!\n\n' + shareUrl);
    }
  };

  window.shareDocument = async (id) => {
    const email = prompt('Enter email address to share with:');
    if (!email) return;
    
    try {
      await fetch(`${API_BASE}/permissions/${id}/allowed-emails`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });
      alert('Access granted!');
    } catch (err) {
      alert('Failed to share document');
    }
  };
  
  window.revokeDocument = async (id) => {
    if (!confirm('Revoke all access to this document?')) return;
    
    try {
      await fetch(`${API_BASE}/documents/${id}/revoke`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${TOKEN}` }
      });
      alert('Document access revoked');
      loadDocuments();
    } catch (err) {
      alert('Failed to revoke access');
    }
  };
  
  window.terminateSession = async (id) => {
    if (!confirm('Terminate this viewing session?')) return;
    
    try {
      await fetch(`${API_BASE}/monitoring/terminate/${id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${TOKEN}` }
      });
      alert('Session terminated');
      loadSessions();
    } catch (err) {
      alert('Failed to terminate session');
    }
  };
  
  // Logout
  document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('authToken');
    window.location.href = '/login.html';
  });
  
  // Start
  initialize();
  
})();
