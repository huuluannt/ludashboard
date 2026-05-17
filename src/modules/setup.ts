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

import ConvertImgModule from './convert-img/index';
import { manifest as convertImgManifest } from './convert-img/manifest';

import CollageImgModule from './collage-img/index';
import { manifest as collageImgManifest } from './collage-img/manifest';

import LuVideoModule from './luvideo/index';
import { manifest as luvideoManifest } from './luvideo/manifest';

import LuMapModule from './lumap/index';
import { manifest as lumapManifest } from './lumap/manifest';

import PdfToolsModule from './pdf-tools/index';
import { manifest as pdfToolsManifest } from './pdf-tools/manifest';

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
    { manifest: calculatorManifest, component: CalculatorModule, source: 'native' },
    { manifest: imageResizerManifest, component: ImageResizerModule, source: 'native' },
    { manifest: notesManifest, component: NotesModule, source: 'native' },
    { manifest: convertImgManifest, component: ConvertImgModule, source: 'native' },
    { manifest: collageImgManifest, component: CollageImgModule, source: 'native' },
    { manifest: luvideoManifest, component: LuVideoModule, source: 'native' },
    { manifest: lumapManifest, component: LuMapModule, source: 'native' },
    { manifest: pdfToolsManifest, component: PdfToolsModule, source: 'native' },
  ];

  for (const mod of builtInModules) {
    moduleRegistry.register(mod);
  }

  // Placeholder / future modules
  for (const manifest of placeholderManifests) {
    moduleRegistry.register({
      manifest,
      component: () => PlaceholderModule({ title: manifest.title }),
      source: 'native',
    });
  }
}
