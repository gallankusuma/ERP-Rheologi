Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file

## Project Context
This is a **Manufacturing ERP** system for small businesses built with:
- **Backend**: Node.js + Express + TypeScript + PostgreSQL
- **Frontend**: Vue 3 + Vite + TypeScript + Tailwind CSS
- **Key Modules**: Products, BOM (Bill of Materials), Work Orders, Inventory, Authentication

## Development Guidelines
- Backend runs on port **3000**, frontend on port **5173**
- Use `npm run dev` to start both servers concurrently
- All API routes are in `backend/src/routes/`
- All Vue views are in `frontend/src/views/`
- TypeScript strict mode enabled; ensure type safety
- Use Tailwind CSS utility classes for styling
- Follow RESTful API conventions
- Authentication via JWT stored in localStorage

## Code Style
- Use arrow functions and async/await
- Prefer composition API for Vue components
- Use TypeScript interfaces for data models
- Keep components focused and single-responsibility
- Add descriptive comments for complex business logic

## Database
- PostgreSQL schema in `backend/database/schema.sql`
- Use parameterized queries to prevent SQL injection
- Connection config in `backend/src/config/database.ts`

## Testing & Quality
- Run `npm run lint` before commits
- Ensure no TypeScript errors before deploying
- Test all CRUD operations thoroughly

Work through each checklist item systematically. Keep communication concise and focused. Follow development best practices.

