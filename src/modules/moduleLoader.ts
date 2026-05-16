import type { RegisteredModule } from './moduleTypes';
import { moduleRegistry } from './moduleRegistry';

/**
 * Load and register an array of modules into the registry.
 *
 * In a future version this could dynamically import packages
 * from npm, URLs, or a module marketplace.
 */
export function loadModules(modules: RegisteredModule[]): void {
  for (const mod of modules) {
    moduleRegistry.register(mod);
  }
}

/**
 * Future: dynamically import a module from a package name or URL.
 *
 * @example
 *   await loadRemoteModule('@ludashboard/module-calculator');
 */
export async function loadRemoteModule(_source: string): Promise<void> {
  // Placeholder for future dynamic module loading
  console.info('[ModuleLoader] Remote module loading not yet implemented:', _source);
}
