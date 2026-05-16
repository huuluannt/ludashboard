# Project Overview

## Product Vision
**LuDashboard** is a personal, modular workspace system. It is designed not as a static dashboard with fixed widgets, but rather as a **mini operating environment**. Users can open multiple independent tools and modules concurrently via a tabbed interface, mimicking the experience of modern desktop operating systems or complex IDEs like VSCode.

## App Philosophy
The philosophy of LuDashboard is grounded in **extensibility, independence, and performance**:
- **Extensibility**: The app must grow seamlessly. New features are never hardcoded into the core; they are built as modules.
- **Independence**: A bug or heavy operation in one module should not impact the core shell or other modules.
- **Performance**: The core shell must load instantly and remain lightweight, serving only as the host environment.

## Why Modular Architecture?
A monolithic architecture leads to tangled logic, bloated bundle sizes, and regressions. By enforcing a strict modular boundary, LuDashboard ensures that features remain decoupled. If a user only needs the Calculator and Notes, the codebase doesn't need to tightly bundle the complex logic of a PDF Editor into the core execution path.

## Why Plugin-Ready Architecture?
The ultimate goal of LuDashboard is to support an ecosystem where modules can be distributed as independent packages (e.g., `@ludashboard/module-calculator`). A plugin-ready architecture standardizes the contract between the host and the tools. This guarantees that future developers (or AI agents) can build a tool entirely in isolation and plug it into LuDashboard without modifying the core shell.

## Why Offline-First?
Productivity cannot rely on a constant internet connection. LuDashboard is built offline-first using IndexedDB and Service Workers. If the internet drops, the shell still loads, state is still retrieved, and offline-capable modules continue to function perfectly. 

## Why PWA-First?
LuDashboard is a web app, but it must *feel* like a native desktop app. Being PWA-first means it can be installed locally, open in a standalone window, and operate outside the browser tab ecosystem, bringing it on par with Notion, Obsidian, or Arc Browser.

---

## Separation of Responsibilities

### LuDashboard Core Responsibilities
The Core is **only** a host shell. Its responsibilities are strictly limited to:
- App Shell routing and rendering (Sidebar, Tab Bar, Main Workspace).
- Google OAuth authentication and user session management.
- Module discovery, registry, and loading.
- Managing workspace state (active tabs, open tabs, pinned modules, sidebar state).
- Providing offline persistence for the workspace layout.
- Serving as a PWA host.

### Module Responsibilities
Modules are the actual applications. Their responsibilities include:
- Containing **100%** of their own business logic, UI, and internal state.
- Defining a standard `manifest` detailing their capabilities (offline support, permissions, metadata).
- Managing their own persistence for module-specific data (e.g., the Notes module saving to its own IndexedDB namespace).
- Exposing a standard React component to be rendered by the host.
