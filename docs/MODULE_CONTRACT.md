# Module Contract

This document defines exactly how modules/plugins integrate with LuDashboard.

## The Contract

Every module is treated as an independent application. To plug into LuDashboard, a module must provide a **Manifest** and a **Default React Component**.

### 1. Required Manifest Structure

The `manifest` informs the Core shell about the module without executing its UI code.

```typescript
// src/modules/moduleTypes.ts
export interface ModuleManifest {
  id: string;               // Unique kebab-case identifier (e.g., "pdf-tools")
  title: string;            // Human-readable title
  icon: string;             // Lucide icon name (must exist in Icon.tsx)
  version: string;          // SemVer string
  category: string;         // Grouping category (e.g., "Productivity", "Utilities")
  description: string;      // Short description for the sidebar card
  offline: boolean;         // True if the module functions without internet
  permissions?: string[];   // Optional permissions requested by the module
}
```

### 2. Required Exports

A module folder (e.g., `src/modules/my-module/`) must export:
1. `manifest` from `manifest.ts`
2. `default` from `index.tsx` (The React component)

#### Example: `manifest.ts`
```typescript
import type { ModuleManifest } from '@/modules/moduleTypes';

export const manifest: ModuleManifest = {
  id: 'word-counter',
  title: 'Word Counter',
  icon: 'file-text',
  version: '1.0.0',
  category: 'Utilities',
  description: 'Counts words and characters in real-time.',
  offline: true,
};
```

#### Example: `index.tsx`
```typescript
import { useState } from 'react';

export default function WordCounterModule() {
  const [text, setText] = useState('');
  
  return (
    <div className="h-full p-8 flex flex-col">
      <h2 className="text-xl font-bold mb-4">Word Counter</h2>
      <textarea 
        className="flex-1 p-4 border rounded resize-none"
        value={text}
        onChange={e => setText(e.target.value)}
      />
      <div className="mt-4 text-sm text-gray-500">
        Words: {text.split(/\s+/).filter(w => w).length}
      </div>
    </div>
  );
}
```

### 3. Module Lifecycle & Registry Behavior
Modules are registered at app startup.
- **Internal Modules**: Called in `src/modules/setup.ts` via `moduleRegistry.register()`.
- **Remote/NPM Modules (Future)**: Will dynamically call `moduleRegistry.register()` when imported.

Once registered, the Core reads `moduleRegistry.getAll()` to generate the sidebar cards. When a user clicks a card, the Core renders the component in the `RightPane`.

### 4. Module Boundaries
- **DO NOT** access the Core Zustand stores from within a module.
- **DO NOT** manipulate the DOM outside of the module's React tree.
- **DO NOT** rely on the URL or React Router. The module is rendered based on the active Tab ID, not a URL path.

### 5. Offline Capability Expectations
If `offline: true` is set in the manifest, the module must not crash when `navigator.onLine` is false. Any data fetching should be gracefully handled, and local state should be persisted using IndexedDB.
