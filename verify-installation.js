/**
 * Installation Verification Script
 * Run this to check if everything is configured correctly
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 Verifying Secure Document Platform Installation...\n');

let errors = 0;
let warnings = 0;

// Check Node.js version
console.log('📦 Checking Node.js version...');
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
if (majorVersion >= 18) {
  console.log(`✅ Node.js ${nodeVersion} (OK)\n`);
} else {
  console.log(`❌ Node.js ${nodeVersion} (Required: 18+)\n`);
  errors++;
}

// Check package.json
console.log('📦 Checking package.json...');
try {
  const packageJson = require('./package.json');
  console.log(`✅ Package: ${packageJson.name} v${packageJson.version}\n`);
} catch (err) {
  console.log('❌ package.json not found or invalid\n');
  errors++;
}

// Check node_modules
console.log('📦 Checking dependencies...');
const nodeModulesPath = path.join(__dirname, 'node_modules');
if (fs.existsSync(nodeModulesPath)) {
  const modules = fs.readdirSync(nodeModulesPath).filter(m => !m.startsWith('.'));
  console.log(`✅ ${modules.length} packages installed\n`);
} else {
  console.log('❌ node_modules not found. Run: npm install\n');
  errors++;
}

// Check .env file
console.log('⚙️  Checking environment configuration...');
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  
  // Check required variables
  const required = ['MONGODB_URI', 'JWT_SECRET', 'ENCRYPTION_MASTER_KEY'];
  const missing = [];
  
  for (const key of required) {
    if (!envContent.includes(`${key}=`) || envContent.includes(`${key}=your-`) || envContent.includes(`${key}=<`)) {
      missing.push(key);
    }
  }
  
  if (missing.length === 0) {
    console.log('✅ All required environment variables configured\n');
  } else {
    console.log(`⚠️  Missing or default values: ${missing.join(', ')}\n`);
    warnings++;
  }
} else {
  console.log('❌ .env file not found. Copy .env.example to .env\n');
  errors++;
}

// Check directory structure
console.log('📁 Checking project structure...');
const requiredDirs = [
  'server',
  'server/models',
  'server/routes',
  'server/services',
  'server/middleware',
  'public',
  'public/js',
  'public/js/security',
  'public/js/camera',
  'public/js/utils',
  'public/css'
];

let dirsOk = true;
for (const dir of requiredDirs) {
  if (!fs.existsSync(path.join(__dirname, dir))) {
    console.log(`❌ Missing directory: ${dir}`);
    dirsOk = false;
    errors++;
  }
}

if (dirsOk) {
  console.log('✅ All required directories present\n');
}

// Check key files
console.log('📄 Checking key files...');
const requiredFiles = [
  'server/index.js',
  'server/models/Document.js',
  'server/models/User.js',
  'server/models/Session.js',
  'public/viewer.html',
  'public/dashboard.html',
  'public/js/security/securityManager.js',
  'public/js/camera/cameraMonitor.js',
  'public/js/utils/watermarkOverlay.js',
  'public/js/utils/deviceFingerprint.js'
];

let filesOk = true;
for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(__dirname, file))) {
    console.log(`❌ Missing file: ${file}`);
    filesOk = false;
    errors++;
  }
}

if (filesOk) {
  console.log('✅ All required files present\n');
}

// Check uploads directory (will be created automatically, but good to verify permissions)
console.log('📂 Checking uploads directory...');
const uploadsPath = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsPath)) {
  try {
    fs.mkdirSync(uploadsPath);
    console.log('✅ Created uploads directory\n');
  } catch (err) {
    console.log('⚠️  Cannot create uploads directory (may need permissions)\n');
    warnings++;
  }
} else {
  console.log('✅ Uploads directory exists\n');
}

// Test MongoDB connection (optional, commented out to avoid connection errors during verify)
console.log('🗄️  MongoDB connection check...');
console.log('⏭️  Skipped (will check on server start)\n');

// Summary
console.log('═══════════════════════════════════════\n');
console.log('📊 VERIFICATION SUMMARY\n');
console.log(`Errors: ${errors}`);
console.log(`Warnings: ${warnings}\n`);

if (errors === 0 && warnings === 0) {
  console.log('✅ ALL CHECKS PASSED!\n');
  console.log('You can now start the server with:');
  console.log('  npm run dev (development)');
  console.log('  npm start (production)\n');
  process.exit(0);
} else if (errors === 0) {
  console.log('⚠️  PASSED WITH WARNINGS\n');
  console.log('The application should work, but review warnings above.\n');
  console.log('You can start the server with:');
  console.log('  npm run dev\n');
  process.exit(0);
} else {
  console.log('❌ VERIFICATION FAILED\n');
  console.log('Please fix the errors above before starting the server.\n');
  console.log('Quick fixes:');
  if (!fs.existsSync(nodeModulesPath)) {
    console.log('  1. Run: npm install');
  }
  if (!fs.existsSync(envPath)) {
    console.log('  2. Copy .env.example to .env');
    console.log('  3. Edit .env with your configuration');
  }
  console.log('\nFor detailed setup instructions, see QUICKSTART.md\n');
  process.exit(1);
}
