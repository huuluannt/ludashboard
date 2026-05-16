import type { RegisteredModule } from './moduleTypes';

/**
 * Central module registry.
 *
 * Modules register themselves here. The core shell reads from this
 * registry to populate cards, tabs, and render active modules.
 *
 * External packages call `registerModule()` to plug into LuDashboard.
 */
class ModuleRegistry {
  private modules: Map<string, RegisteredModule> = new Map();

  /** Register a module. Throws if a module with the same id already exists. */
  register(mod: RegisteredModule): void {
    if (this.modules.has(mod.manifest.id)) {
      console.warn(
        `[ModuleRegistry] Module "${mod.manifest.id}" is already registered. Skipping.`,
      );
      return;
    }
    this.modules.set(mod.manifest.id, mod);
  }

  /** Unregister a module by id. */
  unregister(id: string): boolean {
    return this.modules.delete(id);
  }

  /** Get a module by id. */
  get(id: string): RegisteredModule | undefined {
    return this.modules.get(id);
  }

  /** Get all registered modules. */
  getAll(): RegisteredModule[] {
    return Array.from(this.modules.values());
  }

  /** Check if a module is registered. */
  has(id: string): boolean {
    return this.modules.has(id);
  }

  /** Get total count of registered modules. */
  get count(): number {
    return this.modules.size;
  }
}

/** Singleton registry instance shared across the application. */
export const moduleRegistry = new ModuleRegistry();
