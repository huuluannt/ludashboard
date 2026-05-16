# AI Agent Guide 🤖

**ATTENTION: Claude, ChatGPT, Codex, Antigravity, or any future AI assistant.**

You are reading the **persistent institutional memory** of LuDashboard. 
If you have been asked to write code, fix a bug, or add a feature, **YOU MUST ADHERE TO THESE INSTRUCTIONS.**

## 1. How to Think About LuDashboard
Do not think of this as a standard React single-page application.
Think of it as a **Miniature Operating System** running in the browser.
- **The Core (`src/app/`, `src/layout/`)** is the OS Shell. It handles the window manager (Tabs) and the launcher (Sidebar).
- **The Modules (`src/modules/`)** are the individual apps running on this OS.

## 2. Architectural Mistakes to Avoid
- **NEVER** add feature-specific logic to the Core. If the user asks for a "Word Counter", DO NOT put word counting logic in `RightPane.tsx`. You must create a new module under `src/modules/word-counter/`.
- **NEVER** alter the `display: none` logic in `RightPane.tsx` to conditionally unmount components based on the active tab. Unmounting destroys local React state (like unsaved text). The inactive tabs MUST remain in the DOM.
- **NEVER** create global CSS that bleeds into modules. Modules should style themselves using Tailwind classes.

## 3. Rules That Must Never Be Broken
1. **The Module Contract**: Every module must export a `manifest` and a `default` React component. No exceptions.
2. **No Core-Module Coupling**: The Core must not know what the module does. It only reads the manifest.
3. **Offline-First**: Do not assume the user has internet. Use IndexedDB for storage. Do not add arbitrary server dependencies unless specifically building an online-only module (like Cloud Storage).

## 4. How to Create a New Module
When instructed to build a new tool:
1. Create a folder: `src/modules/{tool-name}/`
2. Create `manifest.ts` containing the `ModuleManifest`.
3. Create `index.tsx` containing the UI and business logic.
4. Go to `src/modules/setup.ts` and import your module.
5. Call `moduleRegistry.register()` in the `setupModules()` function.
6. Verify the icon used in the manifest exists in `src/components/Icon.tsx`.

## 5. Preserving Scalability
When adding features, ask yourself: "If this app has 100 modules installed, will this change cause performance issues?"
- Only load module code when necessary. (Future iteration will use React.lazy).
- Keep the `ModuleRegistry` clean.

## 6. Preserving PWA / Desktop UX
- Do not use `<a>` tags for internal navigation. Use the `useTabStore` to open modules.
- Ensure all interactive elements have hover states.
- Ensure the app remains installable. Do not break the `vite-plugin-pwa` configuration.

---
*By reading this document, you are equipped with the context needed to safely modify LuDashboard without corrupting its architecture. Proceed with your coding task.*
