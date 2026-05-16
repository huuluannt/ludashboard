# Architecture Rules

These rules are permanent and **MUST NOT BE BROKEN** by any developer or AI agent contributing to the project.

## 1. STRICT Anti-Monolith Rule
**Do NOT turn LuDashboard into a monolithic app.**
The `src/app/` and `src/layout/` directories must **never** contain business logic for specific features like calculators, note-taking, or file processing. Core must remain incredibly lightweight. 

## 2. Feature Isolation
- **Feature logic belongs inside modules.**
- Modules must remain entirely isolated from one another. Module A cannot directly import state or components from Module B.
- Core must not tightly couple module logic. The core shell renders `<ActiveModuleComponent />` dynamically and blindly.

## 3. Plugin-Ready Architecture
Future and external modules are meant to be imported dynamically as online iframe URLs or packages.
- Modules can be imported via online iframe URLs. The Core maintains an `ImportedModule` state synced to Firestore.
- Therefore, the Core must interact with modules **strictly through the Module Registry (`src/modules/moduleRegistry.ts`)**.
- Modules must expose a `manifest` that the Core reads to understand how to render the module's card and tab.

## 4. State Management Principles
- **Core State (`src/state/`)**: Managed by Zustand. Only global workspace state belongs here (Tabs, Sidebar, User Auth).
- **Module State**: Modules must manage their own state using standard React hooks (`useState`, `useReducer`), localized Zustand stores, or local persistence. Core state must *never* track the internal variables of a module (e.g., Core does not know what text is typed in the Notes module).

## 5. Tab System Rules
- Opening a module creates a tab.
- If a module is already open, clicking its card again **switches** to the existing tab. Do not open duplicate tabs for single-instance modules.
- Switching tabs hides the inactive module via CSS (`display: none`) rather than unmounting it. **This is critical** to ensure module state (like unsaved text or a running timer) is preserved when navigating between tabs.

## 6. Sidebar Behavior Rules
- The sidebar is for navigation, search, and module launching, not for doing actual work.
- It supports expanded and collapsed states. The collapsed state must remain functional using icons only.
- Pinned modules appear at the top.

## 7. Storage and Cloud Sync Rules
- The app must load and function without an internet connection.
- Core UI state (tabs, pins, sidebar toggle, imported modules) must be persisted locally via IndexedDB (`idb-keyval`).
- State changes merge asynchronously to a Firebase Firestore backend based on the authenticated Google User ID.
- Modules should default to saving their internal data locally (e.g., Notes saves to IndexedDB) and syncing later if cloud features are added. Do not sync module data into the global Core config.

## 8. PWA & Desktop-Like UX Rules
- Preserve the desktop-like feel. No page reloads.
- No standard browser behaviors like blue default focus rings or text-selection on UI control elements.
- The interface must respond instantly to clicks (optimistic UI updates).
- Service workers must be maintained for offline asset caching.
