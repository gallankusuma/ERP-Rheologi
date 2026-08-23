// This module used to create a second axios instance with a hardcoded
// http://localhost:3001 base, so every call made through it pointed at the viewer's own
// machine once deployed, and missed the /api prefix even in development.
// There is one API client, and it lives in lib/api.
export { api as default } from '../lib/api';
