# MySQL Setup Guide for ERP Manufacturing System

## Prerequisites

- MySQL Server 5.7 or higher
- MySQL Admin access
- Backend running on Node.js

## Step 1: Create MySQL Database

### Option A: Using MySQL Command Line

```bash
mysql -u root -p
```

Then execute:

```sql
CREATE DATABASE IF NOT EXISTS erp_manufacturing 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

USE erp_manufacturing;
```

### Option B: Using MySQL Workbench

1. Open MySQL Workbench
2. Create new connection to localhost:3306
3. Run the following SQL:

```sql
CREATE DATABASE IF NOT EXISTS erp_manufacturing 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;
```

## Step 2: Configure Backend Environment

Create or update `.env` file in `backend/` directory:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=erp_manufacturing

# Server Configuration
PORT=3000
NODE_ENV=development

# JWT Secret
JWT_SECRET=your_jwt_secret_key_here

# Frontend URL
FRONTEND_URL=http://localhost:5173
```

## Step 3: Initialize Database Schema

The schema will be automatically created when you start the backend server. The system will:

1. Create all 34+ required tables
2. Set up proper indexes for performance
3. Create default roles and permissions
4. Seed default users (admin account)
5. Initialize system settings

### Manual Schema Execution (Optional)

If you want to manually execute the schema:

```bash
mysql -u root -p erp_manufacturing < backend/database/schema_mysql.sql
```

## Step 4: Start the Backend Server

```bash
cd backend
npm install
npm run dev
```

The backend will automatically:
- Connect to MySQL database
- Create schema if it doesn't exist
- Seed default data
- Start listening on port 3000

## Step 5: Verify Installation

Check the backend console output for:

```
🔗 Connected to MySQL database: erp_manufacturing
✅ Database schema initialized successfully
✅ Default admin user created (username: admin, password: admin123)
✅ Default departments created
```

## Default Admin Credentials

- **Username:** admin
- **Password:** admin123
- **Email:** admin@erp.local

⚠️ **IMPORTANT:** Change the default password immediately after first login!

## Connection Pooling Configuration

The system uses MySQL2 connection pooling with:

- **Max Connections:** 10
- **Queue Limit:** Unlimited
- **Keep Alive:** Enabled

Adjust in `backend/src/config/database.ts` if needed for your environment.

## Troubleshooting

### Error: "Access denied for user 'root'@'localhost'"

Check your MySQL password in `.env` file:

```env
DB_PASSWORD=your_actual_password
```

### Error: "Database 'erp_manufacturing' doesn't exist"

Manually create the database:

```sql
CREATE DATABASE erp_manufacturing CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### Error: "PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR"

Usually caused by:
1. MySQL server not running
2. Wrong connection credentials
3. Network connectivity issues

**Solutions:**
- Verify MySQL is running: `mysql -u root -p -e "SELECT 1"`
- Check credentials in `.env`
- Restart MySQL service

### Slow Query Issues

Check indexes are created:

```sql
USE erp_manufacturing;
SHOW KEYS FROM products;
```

## Backing Up Database

```bash
# Backup database
mysqldump -u root -p erp_manufacturing > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore from backup
mysql -u root -p erp_manufacturing < backup_20240204_120000.sql
```

## Performance Optimization

For production, consider:

1. **Increase connection pool:**
   ```typescript
   connectionLimit: 20 // for higher concurrency
   ```

2. **Add database indexes for frequent queries**

3. **Enable query caching (if using MySQL 5.7)**

4. **Regular backups and maintenance:**
   ```sql
   OPTIMIZE TABLE products, sales_orders, inventory_stocks;
   ANALYZE TABLE work_orders, batches;
   ```

## Migration from SQLite

The old SQLite database backup is located at:
- `backend/src/config/database-sqlite.ts.backup`
- Old route files: `.old` extensions

If you need to migrate data from SQLite:

```bash
# Tools to consider:
# - SQLite to MySQL converter tools
# - Manual CSV export/import
# - Custom migration scripts
```

---

**Next Steps:**
1. Set up MySQL database
2. Configure `.env` file
3. Start backend server with `npm run dev`
4. Access the system at `http://localhost:5173`
5. Login with admin credentials
6. Change admin password immediately
7. Create additional users and departments as needed
