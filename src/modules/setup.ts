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

import LuMusicModule from './lumusic/index';
import { manifest as lumusicManifest } from './lumusic/manifest';

import LuMapModule from './lumap/index';
import { manifest as lumapManifest } from './lumap/manifest';

import PdfToolsModule from './pdf-tools/index';
import { manifest as pdfToolsManifest } from './pdf-tools/manifest';

import LuChatModule from './luchat/index';
import { manifest as luchatManifest } from './luchat/manifest';

import LuGeminiModule from './lugemini/index';
import { manifest as lugeminiManifest } from './lugemini/manifest';

import CloudStorageModule from './cloud-storage/index';
import { manifest as cloudStorageManifest } from './cloud-storage/manifest';

import UnitConverterModule from './unit-converter/index';
import { manifest as unitConverterManifest } from './unit-converter/manifest';

import WorldClockModule from './world-clock/index';
import { manifest as worldClockManifest } from './world-clock/manifest';

import LuCalendarModule from './lucalendar/index';
import { manifest as luCalendarManifest } from './lucalendar/manifest';

import LuClassroomModule from './luclassroom/index';
import { manifest as luClassroomManifest } from './luclassroom/manifest';

import LuDichModule from './ludich/index';
import { manifest as luDichManifest } from './ludich/manifest';

import LuIconModule from './luicon/index';
import { manifest as luIconManifest } from './luicon/manifest';

import LuAnhModule from './luanh/index';
import { manifest as luAnhManifest } from './luanh/manifest';

import LuDanhbaModule from './ludanhba/index';
import { manifest as luDanhbaManifest } from './ludanhba/manifest';

import LuGmailModule from './lugmail/index';
import { manifest as luGmailManifest } from './lugmail/manifest';

import LuDriveModule from './ludrive/index';
import { manifest as luDriveManifest } from './ludrive/manifest';

import LuOnedriveModule from './luonedrive/index';
import { manifest as luOnedriveManifest } from './luonedrive/manifest';

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
    { manifest: lumusicManifest, component: LuMusicModule, source: 'native' },
    { manifest: lumapManifest, component: LuMapModule, source: 'native' },
    { manifest: pdfToolsManifest, component: PdfToolsModule, source: 'native' },
    { manifest: luchatManifest, component: LuChatModule, source: 'native' },
    { manifest: lugeminiManifest, component: LuGeminiModule, source: 'native' },
    { manifest: cloudStorageManifest, component: CloudStorageModule, source: 'native' },
    { manifest: unitConverterManifest, component: UnitConverterModule, source: 'native' },
    { manifest: worldClockManifest, component: WorldClockModule, source: 'native' },
    { manifest: luCalendarManifest, component: LuCalendarModule, source: 'native' },
    { manifest: luClassroomManifest, component: LuClassroomModule, source: 'native' },
    { manifest: luDichManifest, component: LuDichModule, source: 'native' },
    { manifest: luIconManifest, component: LuIconModule, source: 'native' },
    { manifest: luAnhManifest, component: LuAnhModule, source: 'native' },
    { manifest: luDanhbaManifest, component: LuDanhbaModule, source: 'native' },
    { manifest: luGmailManifest, component: LuGmailModule, source: 'native' },
    { manifest: luDriveManifest, component: LuDriveModule, source: 'native' },
    { manifest: luOnedriveManifest, component: LuOnedriveModule, source: 'native' },
  ];

  for (const mod of builtInModules) {
    moduleRegistry.register(mod);
  }

  // Placeholder / future modules
  for (const manifest of placeholderManifests.filter((item) => item.id !== cloudStorageManifest.id)) {
    moduleRegistry.register({
      manifest,
      component: () => PlaceholderModule({ title: manifest.title }),
      source: 'native',
    });
  }
}
