import path from 'path';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { bootstrapSchema } from '../lib/schemaBootstrap';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MIGRATION_DIR = path.resolve(__dirname, '../../database/migrations');
const BASELINE_PATH = path.resolve(__dirname, '../../database/schema_mysql.sql');

async function main() {
  console.log('ERP Migration Runner (CLI)');
  console.log('=========================');

  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'erp_manufacturing',
    waitForConnections: true,
    connectionLimit: 2,
  });

  const conn = await pool.getConnection();

  try {
    // same entry point the server uses, so the CLI and startup can never disagree
    const bootstrap = await bootstrapSchema(conn, { baselinePath: BASELINE_PATH, migrationDir: MIGRATION_DIR });
    const result = bootstrap.migrations;
    console.log(`  Baseline:         ${bootstrap.baseline}`);

    console.log('');
    console.log('Result:');
    console.log(`  Total files:      ${result.totalFiles}`);
    console.log(`  Already applied:  ${result.alreadyApplied}`);
    console.log(`  Newly applied:    ${result.newlyApplied}`);

    if (result.errors.length > 0) {
      console.error('');
      console.error('Errors:');
      for (const err of result.errors) {
        console.error(`  - ${err}`);
      }
      process.exit(1);
    }

    console.log('');
    console.log('Migration complete.');
    process.exit(0);
  } finally {
    conn.release();
    await pool.end();
  }
}

// Only when this file is the program being run.
//
// Without the guard, `require`-ing this module applies migrations as a side effect. That is
// how a deploy pre-flight check -- which only meant to ask "can node load this file?" -- ran a
// real migration against the production database. Applying DDL has to be something you ask
// for, never something that happens because a file was loaded.
if (require.main === module) {
  main().catch(err => {
    console.error('Migration runner failed:', err);
    process.exit(1);
  });
}
