/**
 * Dynamic Lucide icon renderer.
 *
 * Maps module icon names (from manifests) to actual Lucide React components.
 * This avoids importing all 1000+ icons — only the ones we need are listed.
 */
import {
  Calculator,
  Image,
  StickyNote,
  FileText,
  Ruler,
  Cloud,
  Globe,
  Package,
  Settings,
  Palette,
  Keyboard,
  LogOut,
  Search,
  Pin,
  MoreHorizontal,
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
  User,
  Boxes,
  NotebookPen,
} from 'lucide-react';
import type { LucideProps } from 'lucide-react';
import type { ComponentType } from 'react';

const iconMap: Record<string, ComponentType<LucideProps>> = {
  calculator: Calculator,
  image: Image,
  'sticky-note': StickyNote,
  'file-text': FileText,
  ruler: Ruler,
  cloud: Cloud,
  globe: Globe,
  package: Package,
  settings: Settings,
  palette: Palette,
  keyboard: Keyboard,
  'log-out': LogOut,
  search: Search,
  pin: Pin,
  'more-horizontal': MoreHorizontal,
  plus: Plus,
  x: X,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  user: User,
  boxes: Boxes,
  'notebook-pen': NotebookPen,
};

interface IconProps extends LucideProps {
  name: string;
}

export const availableIcons = Object.keys(iconMap);

export default function Icon({ name, ...props }: IconProps) {
  const IconComponent = iconMap[name];
  if (!IconComponent) {
    return <Package {...props} />;
  }
  return <IconComponent {...props} />;
}
