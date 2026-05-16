# Changelog

All notable changes to the LuDashboard architecture and feature set will be documented in this file.

## [1.3.0] - Production Deployment Readiness
**Date:** 2026-05-17

### Added
- Git repository initialized pointing to `https://github.com/huuluannt/ludashboard.git`.
- Strict `.gitignore` updates ensuring `.env` secrets are never committed.
- Authored `docs/DEPLOYMENT_GUIDE.md` detailing Vercel deployment, Google OAuth setup (Client IDs, Origins), and Firebase security rules.
- Added `vercel.json` for guaranteed SPA routing behavior.
- Solved `tsconfig.json` baseUrl deprecation warnings to ensure strict `npm run build` passes on Vercel CI.

### Architectural Impact
- Verified the complete end-to-end production pipeline. The "Online Iframe Import" model combined with Vercel deployment fully realizes the plugin-ready vision.



## [1.2.0] - Cloud Sync & Online Iframe Modules
**Date:** 2026-05-17

### Added
- Implemented real-time Cloud Sync using Firebase Firestore, tied to Google OAuth.
- Introduced `SyncManager` to automatically push local IndexedDB workspace state to the cloud and pull it upon login.
- Added a `SyncIndicator` component to visually communicate sync status (Syncing, Synced, Offline Mode, Sync Error) in a subtle, desktop-like UI.
- Converted the "Install Module" system to "Import Module," allowing users to paste a URL to any online-hosted web application and embed it as a module.
- Replaced local iframe-based apps (like `external/Lufast/`) with the online URL importing strategy.

### Architectural Impact
- Eliminated dependencies on local static folders for iframe apps, fully embracing a decoupled, URL-based plugin architecture.
- Maintained offline-first principles: the app always loads from IndexedDB instantly, merging Firestore data in the background.



## [1.1.0] - Lufast Module Integration
**Date:** 2026-05-17

### Added
- Integrated the legacy Lufast application as a manually registered internal module.
- Employed an iframe sandboxing strategy (`src/modules/lufast/`) to strictly isolate Lufast's CSS, JavaScript, and routing from the LuDashboard Core.
- Moved `external/Lufast/` distribution files into `public/lufast/` for static serving.
- Updated `Icon.tsx` to support the `notebook-pen` lucide icon dynamically.

### Architectural Impact
- Validated the iframe-based integration method as a safe path for migrating complex standalone web apps into the LuDashboard module contract without architectural pollution.


## [1.0.1] - Bug Fixes & OAuth Preparation
**Date:** 2026-05-16

### Fixed
- Fixed an issue where the sidebar collapse toggle button was hidden due to `overflow-hidden`. Replaced the brand area layout with a centered expand button when in the collapsed state, maintaining the clean visual language.
- Fixed the mocked Google OAuth implementation. Implemented actual `@react-oauth/google` `useGoogleLogin` hook, wrapping the application in a `GoogleOAuthProvider`.
- Added a `.env.example` file to document the exact setup requirements for Google OAuth credentials.

### Architectural Impact
- No architectural deviations. OAuth relies strictly on the `fetchGoogleUserInfo` function passing user data to the existing Zustand `userStore` for local IndexedDB persistence.

## [1.0.0] - Initial PWA Build
**Date:** 2026-05-16

### Added
- Initial scaffolding using Vite + React 19 + Tailwind v4.
- Core layout components (`AppShell`, `LeftPane`, `TopRightPane`, `RightPane`).
- Singleton Module Registry and Module Contract interfaces.
- Zustand state management with IndexedDB hydration for offline layout persistence.
- Built-in modules: Calculator, Image Resizer, Notes.
- Placeholder modules for future implementation.
- PWA infrastructure: Service Worker, Install Prompt, Offline Indicator, Workbox caching.

### Architectural Impact
- Established strict separation of concerns: Core shell vs. Modules.
- Established IndexedDB as the primary persistence mechanism for both Core Layout and Module data.
- Proved out the tabbed rendering system utilizing `display: none` for state preservation.

### Modules Affected
- Initialized `@ludashboard/calculator`
- Initialized `@ludashboard/image-resizer`
- Initialized `@ludashboard/notes`
