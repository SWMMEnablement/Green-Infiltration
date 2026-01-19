# Green-Ampt Infiltration Calculator

## Overview

A scientific web application for calculating infiltration rates using the Green-Ampt and Green-Ampt Modified methods, commonly used in SWMM5 (Storm Water Management Model) hydrological modeling. The application provides real-time infiltration curve visualization, soil type presets, and interactive parameter adjustment through sliders for educational and professional use in hydrology and stormwater engineering.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight client-side routing)
- **State Management**: TanStack React Query for server state, React useState for local state
- **Styling**: Tailwind CSS v4 with shadcn/ui component library (New York style)
- **Charts**: Recharts for infiltration curve visualization
- **Build Tool**: Vite with custom plugins for Replit integration

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ESM modules
- **API Pattern**: RESTful endpoints prefixed with `/api`
- **Development**: Hot module replacement via Vite middleware
- **Production**: Static file serving from built assets

### Data Storage
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` for shared type definitions
- **Current Storage**: In-memory storage implementation (`MemStorage` class)
- **Database Ready**: Configured for PostgreSQL via `DATABASE_URL` environment variable

### Project Structure
```
├── client/           # React frontend application
│   ├── src/
│   │   ├── components/ui/  # shadcn/ui components
│   │   ├── pages/          # Page components (green-ampt.tsx)
│   │   ├── hooks/          # Custom React hooks
│   │   └── lib/            # Utilities and query client
├── server/           # Express backend
│   ├── index.ts      # Server entry point
│   ├── routes.ts     # API route definitions
│   ├── storage.ts    # Data storage interface
│   └── vite.ts       # Vite dev server integration
├── shared/           # Shared types and schemas
│   └── schema.ts     # Drizzle schema definitions
└── migrations/       # Database migrations (Drizzle Kit)
```

### Key Design Patterns
- **Monorepo Structure**: Client, server, and shared code in single repository
- **Type Sharing**: Shared schema between frontend and backend via `@shared/*` path alias
- **Component Library**: Pre-built shadcn/ui components with Radix UI primitives
- **API Client**: Centralized fetch wrapper with React Query integration

## External Dependencies

### Database
- **PostgreSQL**: Primary database (requires `DATABASE_URL` environment variable)
- **Drizzle Kit**: Schema migrations via `npm run db:push`

### UI Component Libraries
- **Radix UI**: Headless UI primitives (dialog, dropdown, tabs, tooltips, etc.)
- **Recharts**: Data visualization for infiltration curves
- **Lucide React**: Icon library

### Development Tools
- **Vite**: Frontend build and development server
- **esbuild**: Production server bundling
- **TypeScript**: Type checking across full stack

### Replit-Specific Integrations
- **@replit/vite-plugin-runtime-error-modal**: Error overlay in development
- **@replit/vite-plugin-cartographer**: Development tooling
- **@replit/vite-plugin-dev-banner**: Development environment indicator
- **Custom meta-images plugin**: OpenGraph image handling for deployments