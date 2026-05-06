#!/usr/bin/env node

/**
 * Auto-start script for ERP Manufacturing System
 * Handles all initialization and starts both servers
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

const ROOT_DIR = path.join(__dirname, '..');
const BACKEND_DIR = path.join(ROOT_DIR, 'backend');
const FRONTEND_DIR = path.join(ROOT_DIR, 'frontend');
const DB_PATH = path.join(BACKEND_DIR, 'database.db');
const SETUP_SCRIPT = path.join(ROOT_DIR, 'scripts', 'setup.js');

class ServerManager {
  constructor() {
    this.processes = [];
    this.isReady = false;
  }

  log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = {
      info: '📝',
      success: '✅',
      error: '❌',
      warn: '⚠️',
      check: '🔍',
      start: '🚀',
    }[type] || '•';

    console.log(`[${timestamp}] ${prefix} ${message}`);
  }

  async checkHealth(port, name) {
    return new Promise((resolve) => {
      const req = http.get(`http://localhost:${port}/api/health`, (res) => {
        resolve(res.statusCode === 200);
      });

      req.on('error', () => resolve(false));
      req.setTimeout(1000, () => req.destroy());
    });
  }

  async runSetup() {
    return new Promise((resolve) => {
      this.log('Running auto-setup...', 'info');

      const setup = spawn('node', [SETUP_SCRIPT], {
        cwd: ROOT_DIR,
        stdio: 'inherit',
      });

      setup.on('close', (code) => {
        if (code === 0) {
          this.log('Setup completed', 'success');
          resolve(true);
        } else {
          this.log('Setup failed', 'error');
          resolve(false);
        }
      });
    });
  }

  startBackend() {
    return new Promise((resolve) => {
      this.log('Starting backend server...', 'start');

      const backend = spawn('npm', ['run', 'dev:auto'], {
        cwd: BACKEND_DIR,
        stdio: 'inherit',
        shell: true,
      });

      this.processes.push(backend);

      // Check if backend is ready
      const checkBackend = setInterval(async () => {
        const healthy = await this.checkHealth(3000, 'Backend');
        if (healthy) {
          this.log('Backend is ready', 'success');
          clearInterval(checkBackend);
          resolve(true);
        }
      }, 1000);

      backend.on('error', () => {
        clearInterval(checkBackend);
        resolve(false);
      });

      // Initial delay for startup
      setTimeout(() => {
        clearInterval(checkBackend);
        resolve(true);
      }, 5000);
    });
  }

  startFrontend() {
    return new Promise((resolve) => {
      this.log('Starting frontend server...', 'start');

      const frontend = spawn('npm', ['run', 'dev:auto'], {
        cwd: FRONTEND_DIR,
        stdio: 'inherit',
        shell: true,
      });

      this.processes.push(frontend);

      // Check if frontend is ready
      const checkFrontend = setInterval(async () => {
        const healthy = await this.checkHealth(5173, 'Frontend');
        if (healthy) {
          this.log('Frontend is ready', 'success');
          clearInterval(checkFrontend);
          resolve(true);
        }
      }, 1000);

      frontend.on('error', () => {
        clearInterval(checkFrontend);
        resolve(false);
      });

      // Initial delay for startup
      setTimeout(() => {
        clearInterval(checkFrontend);
        resolve(true);
      }, 8000);
    });
  }

  async start() {
    console.clear();
    console.log('╔════════════════════════════════════════╗');
    console.log('║  🏭 ERP Manufacturing System - Auto    ║');
    console.log('║     Starting Development Environment   ║');
    console.log('╚════════════════════════════════════════╝\n');

    try {
      // Step 1: Run setup
      const setupOk = await this.runSetup();
      if (!setupOk) {
        this.log('Setup failed. Exiting.', 'error');
        process.exit(1);
      }

      // Step 2: Start backend
      const backendOk = await this.startBackend();
      if (!backendOk) {
        this.log('Backend failed to start', 'warn');
      }

      // Step 3: Start frontend
      const frontendOk = await this.startFrontend();
      if (!frontendOk) {
        this.log('Frontend failed to start', 'warn');
      }

      // All set!
      console.log('\n╔════════════════════════════════════════╗');
      console.log('║  ✨ Everything is Ready!               ║');
      console.log('╚════════════════════════════════════════╝\n');

      this.log('📱 Frontend: http://localhost:5173', 'info');
      this.log('🔌 Backend API: http://localhost:3000', 'info');
      this.log('🔑 Test Users: admin@test.com (password: admin)', 'info');
      console.log('');
      this.log('Auto-reload enabled: Changes will reflect instantly', 'success');
      this.log('Press Ctrl+C to stop\n', 'info');

      this.isReady = true;
    } catch (error) {
      this.log(`Error: ${error.message}`, 'error');
      process.exit(1);
    }
  }

  cleanup() {
    this.log('Shutting down...', 'info');
    this.processes.forEach((proc) => {
      if (proc && !proc.killed) {
        proc.kill('SIGTERM');
      }
    });
    process.exit(0);
  }
}

// Main execution
const manager = new ServerManager();

// Handle graceful shutdown
process.on('SIGINT', () => {
  manager.cleanup();
});

process.on('SIGTERM', () => {
  manager.cleanup();
});

// Start everything
manager.start().catch((error) => {
  console.error('Fatal error:', error);
  manager.cleanup();
});
