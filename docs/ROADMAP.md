# LuDashboard Roadmap

## Short-Term Goals (Next 1-3 Months)
- **Authentication**: Fully wire up Google OAuth with persistence and token refreshing.
- **Rich Text Notes**: Replace the basic `<textarea>` in the Notes module with a robust rich-text editor (e.g., Quill or TipTap).
- **Settings Module**: Create a global settings module to handle themes, shortcuts, and account management.
- **Unit Converter**: Replace the placeholder with a fully functional offline unit converter module.

## Medium-Term Goals (3-6 Months)
- **Remote Module Loading**: Implement logic in `moduleLoader.ts` to dynamically fetch, register, and execute module bundles from external URLs or a module marketplace.
- **Desktop Wrappers**: Package the app using Tauri or Electron to provide native OS integrations (tray icons, native file system access).
- **Module Sandboxing**: Explore Web Workers or iframe isolation for complex third-party modules to guarantee core security.

## Long-Term Goals (1 Year+)
- **Module Ecosystem**: Open a marketplace/registry where developers can publish `@ludashboard/module-*` packages.
- **AI Integration**: Introduce a global AI assistant that can interact with active modules (e.g., summarizing text in the Notes module, or performing math in the Calculator module).
- **Cloud Syncing**: Provide an opt-in cloud sync layer that backs up the local IndexedDB state to a server for multi-device usage.

## Future Module Ideas
- **PDF Tools**: Local, offline PDF merging and splitting.
- **Regex Tester**: Developer tool for testing regular expressions.
- **JSON Formatter**: Offline JSON validation and formatting.
- **World Clock**: Highly visual timezone converter.
- **Pomodoro Timer**: Productivity timer integrated with OS notifications.
