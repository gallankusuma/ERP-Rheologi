    # ERP Manufacturing System

Small business ERP system focused on manufacturing operations, built with **Node.js + Express + PostgreSQL + Vue 3 + TypeScript + Tailwind CSS**.

## 🎯 Quick Start - View Project Overview

**Once the system is running, navigate to:**

```
http://localhost:5173/project
```

This opens the **Project Overview Dashboard** which displays:

- All 9 active modules with their features
- Complete menu structure per design.pdf
- Implementation status of each feature
- Quick navigation to all modules and submenus

📋 **See [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) for detailed module specifications**

---

## Features

- **Authentication & Authorization**: User login/registration with JWT
- **Product Management**: Track products, SKUs, categories
- **Bill of Materials (BOM)**: Define product components and assemblies
- **Work Order Management**: Schedule and track manufacturing jobs
- **Inventory Management**: Real-time inventory tracking with transactions
- **Responsive UI**: Clean interface built with Vue 3 and Tailwind CSS

## Tech Stack

### Backend

- **Node.js** (v18+) with **Express.js**
- **TypeScript** for type safety
- **PostgreSQL** for data persistence
- **JWT** for authentication
- **bcrypt** for password hashing

### Frontend

- **Vue 3** with Composition API
- **Vite** for fast development
- **TypeScript**
- **Tailwind CSS** for styling
- **Pinia** for state management
- **Vue Router** for navigation
- **Axios** for API calls

## Prerequisites

- **Node.js** v18 or higher
- **npm** v9 or higher
- **PostgreSQL** v14 or higher

## Setup Instructions

### 1. Install Dependencies

```powershell
npm install
```

This will install dependencies for both backend and frontend workspaces.

### 2. Database Setup

1. Install PostgreSQL if not already installed
2. Create a new database:

```sql
CREATE DATABASE erp_manufacturing;
```

3. Run the schema script:

```powershell
cd backend/database
psql -U postgres -d erp_manufacturing -f schema.sql
```

### 3. Configure Environment Variables

Copy the example environment file:

```powershell
cd backend
cp .env.example .env
```

Edit `.env` and update database credentials:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=erp_manufacturing
DB_USER=postgres
DB_PASSWORD=your_password_here
JWT_SECRET=your_secret_key_here
```

### 4. Run Development Servers

From the root directory:

```powershell
npm run dev
```

This starts:

- Backend API on `http://localhost:3000`
- Frontend UI on `http://localhost:5173`

Or run individually:

```powershell
# Backend only
npm run dev:backend

# Frontend only
npm run dev:frontend
```

## Project Structure

```
ERP/
├── backend/                # Express.js API
│   ├── src/
│   │   ├── config/        # Database configuration
│   │   ├── routes/        # API routes
│   │   └── index.ts       # Entry point
│   ├── database/          # SQL schema
│   └── package.json
├── frontend/              # Vue 3 app
│   ├── src/
│   │   ├── views/         # Page components
│   │   ├── router/        # Vue Router config
│   │   ├── App.vue
│   │   └── main.ts
│   └── package.json
└── package.json           # Monorepo root
```

## API Endpoints

### Authentication

- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration

### Products

- `GET /api/products` - List all products
- `GET /api/products/:id` - Get product details
- `POST /api/products` - Create product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product

### BOM (Bill of Materials)

- `GET /api/bom` - List all BOMs
- `GET /api/bom/:id` - Get BOM details
- `POST /api/bom` - Create BOM

### Work Orders

- `GET /api/workorders` - List all work orders
- `GET /api/workorders/:id` - Get work order details
- `POST /api/workorders` - Create work order
- `PUT /api/workorders/:id` - Update work order

### Inventory

- `GET /api/inventory` - List all inventory items
- `GET /api/inventory/:id` - Get inventory details
- `POST /api/inventory` - Add inventory item
- `PUT /api/inventory/:id` - Update inventory

## Development

### Linting

```powershell
npm run lint
```

### Formatting

```powershell
npm run format
```

### Build for Production

```powershell
npm run build
```

## Next Steps

1. Implement authentication controllers and JWT middleware
2. Add database models and controllers for each module
3. Implement CRUD operations with PostgreSQL queries
4. Add form validation and error handling
5. Build detailed UI components for each module
6. Add reporting and analytics features
7. Implement role-based access control
8. Add unit and integration tests

## License

MIT

## Support

For issues or questions, please open an issue in the repository.
