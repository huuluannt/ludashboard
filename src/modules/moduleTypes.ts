import type { ComponentType } from 'react';

/**
 * Module manifest — the contract every module must satisfy.
 */
export interface ModuleManifest {
  /** Unique module identifier (kebab-case) */
  id: string;
  /** Human-readable title */
  title: string;
  /** Lucide icon name (e.g. "calculator", "image") */
  icon: string;
  /** SemVer string */
  version: string;
  /** Category for grouping */
  category: string;
  /** Short description shown in cards */
  description: string;
  /** Whether the module works without internet */
  offline: boolean;
  /** Whether the module should open outside the dashboard tab area */
  openInNewWindow?: boolean;
  /** Optional permissions the module requires */
  permissions?: string[];
}

/**
 * A registered module = manifest + the React component to render.
 */
export interface RegisteredModule {
  manifest: ModuleManifest;
  component: ComponentType;
  source?: 'native' | 'imported';
}

/**
 * Tab state stored in the workspace.
 */
export interface TabItem {
  /** Same as module id */
  moduleId: string;
  /** Tab display title */
  title: string;
  /** Icon name */
  icon: string;
}
