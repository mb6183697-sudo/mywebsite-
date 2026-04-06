# Workspace

## Overview

This project is a pnpm monorepo using TypeScript, designed for a Turkish BIST spot trading platform named "1000 Yatırımlar". The platform aims to provide a comprehensive trading experience with real-time data, user account management, and administrative functionalities. It includes a user-facing trading application, an API server, and a separate admin panel. The business vision is to capture the Turkish investment market with a robust and user-friendly platform.

## User Preferences

The user prefers detailed explanations. The user prefers iterative development. The user wants the agent to ask before making major changes.

## System Architecture

The project is structured as a pnpm workspace monorepo. It leverages Node.js 24 and TypeScript 5.9. The backend API is built with Express 5, utilizing PostgreSQL with Drizzle ORM for data persistence and Zod for validation. API code generation is handled by Orval from an OpenAPI specification. Frontend applications are built with Vite.

**Monorepo Structure:**
- `artifacts/`: Deployable applications (e.g., `api-server`, `bist-trading`, `admin-panel`).
- `lib/`: Shared libraries (e.g., `api-spec`, `api-client-react`, `api-zod`, `db`).
- `scripts/`: Utility scripts.

**Technical Implementations & Features:**

*   **API Server (`api-server`):**
    *   Express.js based API, routes use `@workspace/api-zod` for validation and `@workspace/db` for persistence.
    *   Handles authentication (registration, login, profile management, 2FA), deposit/withdrawal requests, tier applications, campaigns, expert picks, and notifications.
    *   Integrates with Yahoo Finance for real-time stock prices (BIST .IS suffix).
    *   Includes a DB-backed stock registry with auto-discovery and admin management.
    *   Enforces BIST market hours for order placement (Mon-Fri 10:00-18:00 Istanbul time).
    *   Auth routes are mounted under `/api/auth`.
    *   JWTs have a 30-day expiry. Trading app uses `auth_token` with `userId` payload, Admin panel uses `admin_auth_token` with `adminId` payload.

*   **Database (`db`):**
    *   Drizzle ORM with PostgreSQL.
    *   Manages schemas for users, admin accounts, notifications, campaigns, expert picks, deposit/withdrawal requests, tier applications, and BIST stocks.

*   **Frontend (`bist-trading`):**
    *   Vite application, all UI in Turkish.
    *   Features include a mobile-friendly bottom navigation, live stock prices with a 30-second refresh interval, news section with campaigns, expert picks, portfolio history, and a comprehensive profile management section (deposit, withdrawal, password change, 2FA setup, tier application).
    *   A critical fix ensures the auth token is available in `localStorage` synchronously before API calls.
    *   Includes a real-time live support chat system with unread message badges and category selection.

*   **Admin Panel (`admin-panel`):**
    *   Separate Vite application accessible via `/admin-panel/`.
    *   Requires `admin_auth_token` for access.
    *   Features a "God Mode" dashboard, user management (search, detail, balance adjustment, identity verification), deposit/withdrawal request approval, tier application management, notification broadcasting, and CRUD operations for addresses, campaigns, and expert picks.
    *   Uses an `admin_accounts` table with role-based permissions (superadmin vs. sub-admins).

**Design Choices:**
*   **Monorepo:** Facilitates shared code and consistent tooling.
*   **TypeScript:** Ensures type safety across the project.
*   **OpenAPI + Orval:** Standardizes API definition and enables robust client/schema generation.
*   **Real-time Prices:** Yahoo Finance integration for dynamic stock data.
*   **Notifications System:** DB-backed notifications with user and admin interfaces.
*   **Authentication:** Robust JWT-based authentication with 2FA support and separate flows for trading app and admin panel.
*   **Routing:** Replit router directs `/api/*` to the API server and `/*` to the `bist-trading` frontend.
*   **UI/UX:** All UI is in Turkish. Mobile bottom navigation for core features. Confirmation dialog for external links.

## External Dependencies

*   **PostgreSQL:** Primary database.
*   **Yahoo Finance:** Real-time stock price data.
*   **qrcode.react:** Client-side QR code generation for 2FA.
*   **Namecheap:** Domain registration (planned).
*   **Cloudflare:** DNS management, security (DDoS, WAF, Bot Fight Mode) (planned).