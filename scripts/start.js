#!/usr/bin/env node

/**
 * Complete Auto-Start for ERP Manufacturing System
 * Simplified version using npm directly
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class AutoStart {
  constructor() {
    this.processes = [];
    this.startTime = Date.now();
  }

  log(message, icon = '📝') {
    const time = new Date().toLocaleTimeString();
    console.log(`[${time}] ${icon} ${message}`);
  }

  async runCommand(command, args, cwd, name) {
    return new Promise((resolve) => {
      this.log(`Starting ${name}...`, '🚀');
      
      const proc = spawn(command, args, {
        cwd,
        stdio: 'inherit',
        shell: true,
      });

      this.processes.push(proc);
      
      proc.on('close', (code) => {
        if (code !== 0) {
          this.log(`${name} exited with code ${code}`, '⚠️');
        }
      });

      proc.on('error', (error) => {
        this.log(`${name} error: ${error.message}`, '❌');
      });

      // Wait a bit for startup
      setTimeout(() => resolve(true), 3000);
    });
  }

  async start() {
    console.clear();
    console.log('\n╔═══════════════════════════════════════╗');
    console.log('║  🏭 ERP Manufacturing System          ║');
    console.log('║     Auto Starting (Everything)        ║');
    console.log('╚═══════════════════════════════════════╝\n');

    const rootDir = path.join(__dirname, '..');
    const backendDir = path.join(rootDir, 'backend');
    const frontendDir = path.join(rootDir, 'frontend');

    try {
      // Step 1: Setup
      this.log('Running setup checks...', '🔍');
      await this.runCommand('node', ['scripts/setup.js'], rootDir, 'Setup');
      
      this.log('Setup complete!', '✅');
      console.log('');

      // Step 2: Start servers
      this.log('Starting development servers...', '🚀');
      
      // Start both in parallel
      await Promise.all([
        this.runCommand('npm', ['run', 'dev:auto'], backendDir, 'Backend'),
        this.runCommand('npm', ['run', 'dev:auto'], frontendDir, 'Frontend'),
      ]);

      // Display ready message
      console.log('\n╔═══════════════════════════════════════╗');
      console.log('║  ✨ Everything is Ready!              ║');
      console.log('╚═══════════════════════════════════════╝\n');

      this.log('📱 Frontend:', '→');
      console.log('   http://localhost:5173\n');
      
      this.log('🔌 Backend API:', '→');
      console.log('   http://localhost:3000\n');
      
      this.log('🔑 Test Login:', '→');
      console.log('   Email: admin@test.com');
      console.log('   Password: admin\n');

      this.log('✨ Auto-reload enabled for all changes', '💡');
      this.log('Press Ctrl+C to stop\n', '💡');

    } catch (error) {
      this.log(`Fatal error: ${error.message}`, '❌');
      this.cleanup();
    }
  }

  cleanup() {
    this.log('Shutting down servers...', '🛑');
    this.processes.forEach((proc) => {
      if (proc && !proc.killed) {
        proc.kill('SIGTERM');
      }
    });
    process.exit(0);
  }
}

// Start
const manager = new AutoStart();

process.on('SIGINT', () => manager.cleanup());
process.on('SIGTERM', () => manager.cleanup());

manager.start().catch((error) => {
  console.error('Error:', error);
  manager.cleanup();
});
