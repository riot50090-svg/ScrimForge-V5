# ScrimForge V5 Complete

This is the full V5 build: public scrims, registration, WhatsApp handoff, status lookup, admin login, lobby management, registration/payment management, room details, results, leaderboard, audit logs and DB health check.

## Render settings
Build: `npm install && npm run build`
Start: `npm start`

Environment variables:
- DATABASE_URL = Render PostgreSQL Internal Database URL
- AUTH_SECRET = long random secret
- ADMIN_EMAIL = admin login email
- ADMIN_PASSWORD = admin login password
- WHATSAPP_NUMBER = business WhatsApp number with country code, digits only
- NEXT_PUBLIC_SITE_URL = Render site URL

Admin: `/admin`
Health: `/api/health`
