# Badges Management App

Admin web UI for the [BadgesAPI](https://github.com/MachMitGoslar/BadgesAPI) platform. Built with React + Vite + TypeScript.

## Features

- Organisation overview
- Badge template management (create, edit, delete)
- Grant token generation with QR code display
- Authentication via Goslar ID (OIDC / PKCE flow)
- Organisation member management (view members, update roles)
- User profile page (username, visibility settings, profile image)
- Badge portfolio view on profile page

## Requirements

- Node.js 20+
- A running [BadgesAPI](https://github.com/MachMitGoslar/BadgesAPI) instance (for the dev proxy and auth endpoints)

## Getting started

```bash
npm install
npm run dev
```

The dev server starts at `http://localhost:5173/manage/` and proxies `/api` and `/dev` requests to `http://localhost:3001` (the BadgesAPI).

## Auth flow

The app uses the BadgesAPI's `/dev/start?from=manage` PKCE endpoint to authenticate via Goslar ID. After a successful login the OIDC provider redirects back to `/dev/auth` on the API, which then redirects to `/manage/auth-callback?tokens=<base64url>` with the access and refresh tokens.

The access token is stored in `localStorage` and sent as `Authorization: Bearer <token>` on all API requests.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server with hot-reload |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build locally |

## Docker

The app is packaged as a standalone nginx container. The nginx instance serves the static Vite build at `/manage/` and proxies `/api/` and `/dev/` requests to the `badges-api` container.

```bash
# Build and run standalone
docker build -t badges-manage .
docker run -p 3002:80 badges-manage
```

Visit `http://localhost:3002/manage/`.

When running as part of the full stack via Docker Compose (from the parent `BadgesAPI` repository), the service is available on port `3002` automatically.

## Project structure

```
app/
├── src/
│   ├── api/
│   │   └── client.ts        # Typed fetch wrapper + API interfaces
│   ├── auth/
│   │   └── AuthContext.tsx  # Token storage and auth state
│   ├── components/
│   │   ├── Layout.tsx            # Shared page layout with nav
│   │   ├── BadgePreview.tsx      # Badge image preview
│   │   ├── FramePreview.tsx      # SVG frame tier/level picker preview
│   │   ├── CenterpieceSelector.tsx # Centerpiece image upload + selection
│   │   └── ErrorBoundary.tsx     # React error boundary
│   ├── pages/
│   │   ├── Login.tsx        # Sign-in page
│   │   ├── AuthCallback.tsx # OIDC callback handler
│   │   ├── Dashboard.tsx    # Organisation list
│   │   ├── OrgDetail.tsx    # Organisation + badge list
│   │   ├── BadgeForm.tsx    # Create / edit badge template
│   │   ├── TokenManager.tsx # Grant tokens + QR codes
│   │   ├── OrgMembers.tsx   # Organisation member management
│   │   └── UserProfile.tsx  # User profile + badge portfolio
│   ├── App.tsx              # Route definitions
│   └── main.tsx             # App entry point
├── Dockerfile
├── nginx.conf
└── vite.config.ts
```

## Tech stack

- [React 18](https://react.dev/)
- [Vite 6](https://vite.dev/)
- [React Router v6](https://reactrouter.com/)
- [TanStack Query v5](https://tanstack.com/query)
- [Tailwind CSS v4](https://tailwindcss.com/)
- [qrcode.react](https://github.com/zpao/qrcode.react)
