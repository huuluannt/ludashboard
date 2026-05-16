/**
 * Module setup — registers all built-in modules into the registry.
 *
 * Future external modules (npm packages) would also call
 * moduleRegistry.register() at app startup.
 */
import { moduleRegistry } from './moduleRegistry';
import type { RegisteredModule } from './moduleTypes';

// Built-in modules
import CalculatorModule from './calculator/index';
import { manifest as calculatorManifest } from './calculator/manifest';

import ImageResizerModule from './image-resizer/index';
import { manifest as imageResizerManifest } from './image-resizer/manifest';

import NotesModule from './notes/index';
import { manifest as notesManifest } from './notes/manifest';

// Placeholder modules
import { placeholderManifests } from './placeholders';
import PlaceholderModule from './PlaceholderModule';

let _initialized = false;

/** Register all built-in modules */
export function setupModules() {
  if (_initialized) return;
  _initialized = true;

  // Real modules
  const builtInModules: RegisteredModule[] = [
    { manifest: calculatorManifest, component: CalculatorModule },
    { manifest: imageResizerManifest, component: ImageResizerModule },
    { manifest: notesManifest, component: NotesModule },
  ];

  for (const mod of builtInModules) {
    moduleRegistry.register(mod);
  }

  // Placeholder / future modules
  for (const manifest of placeholderManifests) {
    moduleRegistry.register({
      manifest,
      component: () => PlaceholderModule({ title: manifest.title }),
    });
  }
}
