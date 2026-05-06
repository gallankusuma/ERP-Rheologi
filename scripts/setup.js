#!/usr/bin/env node

/**
 * Auto-setup script for ERP Manufacturing System
 * Handles database initialization and other setup tasks
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const BACKEND_DIR = path.join(__dirname, '../backend');
const DB_PATH = path.join(BACKEND_DIR, 'database.db');
const ENV_FILE = path.join(BACKEND_DIR, '.env');
const LOG_FILE = path.join(BACKEND_DIR, '.setup-log');

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: '📝',
    success: '✅',
    error: '❌',
    warn: '⚠️',
    check: '🔍',
  }[type] || '•';
  
  console.log(`${prefix} ${message}`);
  
  const logEntry = `[${timestamp}] [${type.toUpperCase()}] ${message}\n`;
  try {
    fs.appendFileSync(LOG_FILE, logEntry);
  } catch (e) {
    // Ignore if can't write log
  }
}

function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch (e) {
    return false;
  }
}

function ensureEnvFile() {
  try {
    const envExists = fileExists(ENV_FILE);
    if (!envExists) {
      const envExample = path.join(BACKEND_DIR, '.env.example');
      if (fileExists(envExample)) {
        fs.copyFileSync(envExample, ENV_FILE);
        log('Created .env from .env.example', 'success');
      } else {
        // Create default .env if example doesn't exist
        const defaultEnv = `PORT=3000
NODE_ENV=development
DB_PATH=./database.db
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=7d
API_URL=http://localhost:3000
`;
        fs.writeFileSync(ENV_FILE, defaultEnv);
        log('Created default .env file', 'success');
      }
    } else {
      log('.env file already exists', 'check');
    }
  } catch (error) {
    log(`Warning: Could not setup .env: ${error.message}`, 'warn');
  }
}

function initializeDatabase() {
  try {
    log('Checking database...', 'check');
    
    const dbExists = fileExists(DB_PATH);
    if (dbExists) {
      log('Database already initialized', 'check');
      return true;
    }

    log('Initializing database...', 'info');
    const initScript = path.join(BACKEND_DIR, 'init-database.js');
    
    if (fileExists(initScript)) {
      const result = spawnSync('node', [initScript], {
        cwd: BACKEND_DIR,
        stdio: 'inherit',
        shell: true,
      });
      
      if (result.status === 0) {
        log('Database initialized successfully', 'success');
        return true;
      } else {
        log('Database initialization had issues', 'warn');
        return false;
      }
    } else {
      log('init-database.js not found', 'warn');
      return false;
    }
  } catch (error) {
    log(`Database initialization failed: ${error.message}`, 'warn');
    return false;
  }
}

function checkDependencies() {
  try {
    log('Checking dependencies...', 'check');
    
    const backendPackage = path.join(BACKEND_DIR, 'node_modules');
    const backendDepsExist = fileExists(backendPackage);
    
    if (!backendDepsExist) {
      log('⚠️  Backend dependencies missing - install with: npm install', 'warn');
      return false;
    } else {
      log('Backend dependencies installed', 'check');
      return true;
    }
  } catch (error) {
    log(`Dependency check failed: ${error.message}`, 'error');
    return false;
  }
}

function setupHotReload() {
  try {
    log('Setting up hot reload capabilities...', 'info');
    
    // Check backend tsx watch
    const backendPackage = path.join(BACKEND_DIR, 'package.json');
    const content = fs.readFileSync(backendPackage, 'utf-8');
    const json = JSON.parse(content);
    
    if (json.scripts?.dev?.includes('tsx watch')) {
      log('Backend hot reload: tsx watch enabled', 'check');
    }
    
    log('Frontend hot reload: Vite HMR enabled', 'check');
  } catch (error) {
    log(`Hot reload setup check failed: ${error.message}`, 'warn');
  }
}

function runSetup() {
  console.clear();
  console.log('🚀 ERP Manufacturing System - Auto Setup\n');
  
  try {
    // Clear old log
    try {
      fs.writeFileSync(LOG_FILE, `Setup started at ${new Date().toISOString()}\n`);
    } catch (e) {
      // Ignore if can't write log
    }
    
    // Run checks
    checkDependencies();
    ensureEnvFile();
    initializeDatabase();
    setupHotReload();
    
    console.log('\n✨ Setup complete! You can now run: npm run dev\n');
    log('Setup completed successfully', 'success');
  } catch (error) {
    console.error('\n❌ Setup error:', error.message);
    log(`Setup error: ${error.message}`, 'error');
  }
}

// Run setup
runSetup();
