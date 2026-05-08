# LabTrack — Expiry Management System

Hospital reagent and chemical expiry tracking with authentication, team management, barcode scanning, and compliance reporting.

## Stack
- **Next.js 14** (App Router, TypeScript)
- **NextAuth.js** — secure session auth with bcrypt password hashing
- **Prisma ORM** — works with both SQLite (dev) and PostgreSQL (production)
- **SQLite** for local development — zero config, no server needed
- **PostgreSQL** ready for production deployment

---

## Quick Start (Local Development)

### 1. Prerequisites
Install **Node.js LTS** from https://nodejs.org

Verify installation:
```bash
node --version   # should show v18+ or v20+
npm --version
```

### 2. Install dependencies
```bash
cd labtrack
npm install
```

### 3. Generate a secret and update .env
Open `.env` and replace the `NEXTAUTH_SECRET` value. Generate one:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Create the database and seed demo data
```bash
npx prisma db push
npx tsx prisma/seed.ts
```

### 5. Start the app
```bash
npm run dev
```

Open **http://localhost:3000** — you will be redirected to the login page.

### Demo login credentials
| Email | Password | Role |
|-------|----------|------|
| s.chen@labtrack.io | LabTrack2024! | Admin |
| m.patel@labtrack.io | LabTrack2024! | Technician |
| j.osei@labtrack.io | LabTrack2024! | Viewer |

---

## Migrating to PostgreSQL (Production)

### Step 1 — Get a PostgreSQL database
Options: local install, [Supabase](https://supabase.com), [Neon](https://neon.tech), [Railway](https://railway.app), AWS RDS.

### Step 2 — Update prisma/schema.prisma
```prisma
datasource db {
  provider = "postgresql"   // change from "sqlite"
  url      = env("DATABASE_URL")
}
```

### Step 3 — Update .env
```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/labtrack?schema=public"
NEXTAUTH_SECRET="your-32-char-secret"
NEXTAUTH_URL="https://your-domain.com"
```

### Step 4 — Run migrations and seed
```bash
npx prisma migrate dev --name init
npx tsx prisma/seed.ts
```

### Step 5 — Build for production
```bash
npm run build
npm start
```

---

## Useful scripts
```bash
npm run db:push     # Push schema to database (dev)
npm run db:migrate  # Create migration files (production)
npm run db:seed     # Seed demo data
npm run db:studio   # Visual database browser
```

## Changing a password
```bash
node -e "const b=require('bcryptjs');b.hash('NewPass123!',12).then(h=>console.log(h))"
```
Then update the hash in the User table via `npm run db:studio`.
