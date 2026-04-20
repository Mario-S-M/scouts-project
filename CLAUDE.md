# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture Overview

**scouts-app** is a full-stack web application for "Comunidad de Caminantes" (Scouts CC), a scout organization management system.

### Tech Stack
- **Backend**: NestJS (Node.js + TypeScript) with TypeORM ORM
- **Frontend**: Angular 17 with PrimeNG UI components
- **Database**: PostgreSQL
- **Authentication**: JWT with bcrypt password hashing
- **PDF Generation**: pdfmake

### Project Structure

```
scouts-app/
├── backend/              # NestJS API
│   ├── src/
│   │   ├── app/         # Main app module (imports all feature modules)
│   │   ├── auth/        # JWT authentication (guards, strategies, DTOs)
│   │   ├── usuarios/    # User management
│   │   ├── caminantes/  # Scout profiles
│   │   ├── evidencias/  # Evidence submissions (photos/docs)
│   │   ├── insignias/   # Badges/achievements
│   │   ├── camisolas/   # Uniform items
│   │   ├── progreso/    # Scout progression system
│   │   ├── avisos-salida/# Notifications
│   │   ├── dashboard/   # Stats dashboard
│   │   ├── ciclos-programa/# Program cycle management
│   │   ├── informes/    # Monthly reports generator
│   │   └── common/      # Shared config, DB setup, utils
│   └── main.ts          # Entry point
├── frontend/             # Angular SPA
│   └── src/app/
│       ├── app.module.ts
│       ├── app-routing.module.ts
│       ├── core/        # Services, guards, interceptors
│       └── features/    # Feature modules (lazy-loaded)
└── docker-compose.yml    # Local dev with PostgreSQL, PGAdmin
```

### Backend Module Pattern

Each feature module follows this structure:
```
<feature>/
  ├── *.module.ts        # NestJS module definition
  ├── *.controller.ts    # HTTP endpoints
  ├── *.service.ts       # Business logic
  ├── *.entity.ts        # TypeORM entity (database model)
  └── dto/               # Request DTOs with validation
```

Key modules:
- **auth**: JWT login, role-based access (jefe_grupo, sub_jefe_seccion, scout)
- **usuarios**: User management (only jefe_grupo can access)
- **caminantes**: Register and manage scout profiles
- **evidencias**: Upload/approve/reject scout evidence
- **insignias**: Award badges (Obsidiana, Jade, Opalo, Diamante)
- **progreso**: Track achievements (senderos, especialidades, aventuras, iniciativas, eventos, puntas-de-flecha)
- **informes**: Generate monthly reports with PDF export
- **ciclos-programa**: Define program cycles with activities
- **dashboard**: Statistics and overview

### Frontend Routing & Guards

- `AuthGuard`: Protects all routes except `/login`
- `JefeGrupoGuard`: Additional guard for user management (`/usuarios`)
- All routes use lazy-loading via `loadChildren`

## Development Commands

### Quick Start (Recommended)
```bash
# Without Docker (requires local PostgreSQL)
./start-dev.sh

# Or manually:
cd backend && npm install && npm run start:dev &
cd ../frontend && npm install && npm start
```

### With Docker
```bash
docker-compose up -d
# Frontend: http://localhost:4200
# Backend API: http://localhost:3000/api
# PGAdmin: http://localhost:5050 (login: a@b.com / scouts123)
```

### Backend
```bash
cd backend
npm install
npm run start:dev      # Development with ts-node
npm run build          # Build for production
npm run start:prod     # Run built production code
```

### Frontend
```bash
cd frontend
npm install
npm start              # Development server (ng serve)
npm run build          # Production build
```

### Environment Variables
Create `.env` in root:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=scouts_cc
DB_USER=scouts_user
DB_PASSWORD=your_password
PORT=3000
NODE_ENV=development
JWT_SECRET=your_jwt_secret
UPLOAD_DIR=./uploads
```

### Database Setup
```bash
# Start PostgreSQL with Docker
docker-compose up -d postgres

# Create database user
docker-compose exec postgres psql -U postgres -c "CREATE USER scouts_user WITH PASSWORD 'scouts_pass';"
docker-compose exec postgres psql -U postgres -c "CREATE DATABASE scouts_cc OWNER scouts_user;"
docker-compose exec postgres psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE scouts_cc TO scouts_user;"
```

## Authentication & Authorization

### Seed Accounts (created automatically on backend start)
- `mayitolalito@hotmail.com` / `mario123` → `sub_jefe_seccion`
- `a@b.com` / `admin123` → `jefe_grupo` (full access + user management)

### User Roles
- `jefe_grupo`: Full access, can manage users
- `jefe_manada`, `jefe_tropa`, `jefe_comunidad`, `jefe_clan`: Section/Clan leaders
- `sub_jefe_*`: Deputy roles
- `contador_grupo`: Finance-related roles
- `secretario_grupo`: Secretary roles
- `scout`: Young scouts

### Backend Guards
- `@UseGuards(JwtAuthGuard)` on controllers/methods
- All endpoints except `/api/auth/login` require valid JWT

### Frontend Guards
- `canActivate: [AuthGuard]` in route configs
- Menu items conditionally rendered based on user role

### Auth Flow
1. POST `/api/auth/login` → receives `{ email, password }`
2. Backend validates credentials, returns JWT token
3. Frontend stores token, `AuthInterceptor` adds `Authorization: Bearer <token>` to requests
4. Token expires in 8 hours, refresh on logout or expiration

## Database Schema

### Core Tables
- `users`: Main authentication table (email, password, rol, profile fields)
- `caminantes`: Scout profiles (nombre, apellidos, grupo, seccion, edad, fotos)
- `evidencias`: Submitted evidence with states (pendiente, aprobada, rechazada)
- `insignias`: Awarded badges
- `camisolas`: Uniform inventory items
- Entities in `progreso/`: Achievement system (senderos, especialidades, etc.)

### Informes Tables (for monthly reports)
- `informe_mensual`: Main report header
- `alta_baja_informe`: Membership changes
- `asistencia_actividad`: Activity attendance
- `movimiento_financiero`: Financial transactions
- `inventario_item`: Inventory items
- `progresion_informe`: Progress tracking

### Informe Entities
```typescript
InformeMensual:
  id, seccion, anio, mes, creadoPorId, fechaCreacion

AltaBajaInforme:
  id, informeId, fecha, tipo (alta/baja), nombre, apellidos, grupo, cambios

AsistenciaActividad:
  id, informeId, actividadId, caminanteId, presente, horas

MovimientoFinanciero:
  id, informeId, concepto, cantidad, tipo (ingreso/egreso)
```

## Common Tasks

### Run a Single Test
```bash
cd frontend
ng serve
# Tests run automatically via Karma/Jasmine (if configured)

# Or run specific test file
ng test --include='**/caminantes/caminantes.component.spec.ts'
```

### Build for Production
```bash
# Backend
cd backend
npm run build

# Frontend
cd frontend
npm run build
# Output in frontend/dist/

# Copy build to uploads directory (for serving with backend)
cp -r dist/browser/* ../uploads/
```

### Add a New Feature Module
1. Create folder structure: `backend/src/<feature>/` and `frontend/src/app/features/<feature>/`
2. Backend: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `*.entity.ts`, `dto/*.dto.ts`
3. Frontend: `*.module.ts`, `*.component.ts`, `*.routing.module.ts`
4. Import in backend `app.module.ts` and frontend `app.module.ts`
5. Add route in `app-routing.module.ts`
6. Apply guards as needed

### PDF Generation
- Backend uses `pdfmake` to generate PDFs
- `CiclosProgramaController` has PDF preview and download endpoints
- `InformesController` generates monthly report PDFs with all sections

### Entity to Controller Flow
```
User (entity) → UsersService (logic) → UsersController (CRUD endpoints)
  ↓
  Frontend: UsuariosComponent → UsuariosService → API calls
```

### Updating Database Schema
- Backend has `synchronize: true` in dev (⚠️ dangerous for production)
- For production, create migrations manually or disable sync
- Frontend models are TypeScript interfaces that mirror backend entities

## Important Notes

1. **Environment**: Always check `.env` for database credentials before running queries
2. **Docker**: Recommended for local development to avoid PostgreSQL setup
3. **File Uploads**: Backend serves static files from `uploads/` at `/uploads/*`
4. **Role-based Access**: Always verify user role before exposing sensitive features
5. **JWT Secret**: Defined in `.env`, must be secure in production

## Development Environment

This project is configured to use the **Claro (dark) theme** for the Claude Code interface. When opening new tasks or working with complex code, the dark theme provides better contrast for code blocks and documentation.

## UI/UX Guidelines for Frontend

1. **PrimeNG theming**: The app uses PrimeNG with a dark theme configuration (`lara-dark-blue`)
2. **Default theme**: `lara-dark-blue` (dark) is the default theme
3. **Toggle functionality**: Users can toggle between dark (`pi pi-moon`) and light (`pi pi-sun`) themes using the theme button in the navbar
4. **Color palette**: Uses the dark theme colors from PrimeNG's palette
5. **Responsive design**: Ensure all components work on mobile devices
6. **Accessibility**: Maintain good contrast ratios for readability in both themes

## Theme Configuration

**Default theme:** `aura-dark-blue` (dark theme)

**How theme switching works:**
1. The `ThemeService` injects CSS variables (`--surface-0`, `--surface-border`, etc.) into a `<style>` element
2. The theme class is applied to the `<body>` element (e.g., `p-theme-aura-dark-blue`)
3. All colors use CSS variables that automatically adapt when switching themes
4. Custom styles in `styles.scss` use these same variables for consistency

**Theme CSS variables (defined by ThemeService):**
- `--surface-0`: Background color (dark: #18181b, light: #f5f5f5)
- `--surface-border`: Border color (dark: #27272a, light: #d1d5db)
- `--text-color`: Text color (dark: #ffffff, light: #ffffff)
- `--text-color-secondary`: Secondary text (dark: #a1a1aa, light: #a1a1aa)
- `--surface-ground`: Ground/surface color
- `--surface-section`: Section background
- `--surface-card`: Card background
- `color-scheme`: dark or light

**Files for theme system:**
- `frontend/src/app/core/theme.service.ts` - Injects CSS and applies theme class
- `frontend/src/styles.scss` - Uses CSS variables for theming
- `frontend/src/app/app.component.scss` - Button styles for theme toggle

**To customize theme colors:**
1. Edit `frontend/src/app/core/theme.service.ts` to add custom CSS variables
2. Update `frontend/src/styles.scss` to use the appropriate variables

**To change default theme:**
1. Edit `frontend/src/app/core/theme.service.ts` line 7
2. Change `aura-dark-blue` to `aura-light-blue` for light theme default

**Theme names available in PrimeNG:**
- Dark: `aura-dark-blue`, `aura-dark-green`, `aura-dark-teal`, `aura-dark-purple`, `aura-dark-indigo`, etc.
- Light: `aura-light-blue`, `aura-light-green`, `aura-light-teal`, `aura-light-purple`, `aura-light-indigo`, etc.

**Troubleshooting: Theme not changing**

**Symptoms:** Button icon changes but background doesn't change.

**Cause:** CSS variables not being properly injected or styles not using variables.

**Solution:**
1. Ensure `ThemeService.applyTheme()` is being called correctly
2. Check that `styles.scss` uses CSS variables (`var(--surface-0)`) instead of hardcoded colors
3. Clear browser cache (Ctrl+Shift+R / Cmd+Shift+R)
4. Verify the `<style id="prime-theme-css">` element exists in `<head>`

## Existing Memory

Review project memory at:
- `/Users/mario-e-s-m/.claude/projects/-Users-mario-e-s-m-Documents-Nuevo-Programa-Scouts-CC-scouts-app/memory/MEMORY.md`

Contains:
- User roles and authentication system
- Seed accounts and role permissions
