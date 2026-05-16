import LeftPane from '@/layout/LeftPane';
import TopRightPane from '@/layout/TopRightPane';
import RightPane from '@/layout/RightPane';

/**
 * AppShell — the main layout container.
 *
 * ┌──────────┬──────────────────────┐
 * │          │   TopRightPane       │
 * │ LeftPane ├──────────────────────┤
 * │          │                      │
 * │          │     RightPane        │
 * │          │                      │
 * └──────────┴──────────────────────┘
 */
export default function AppShell() {
  return (
    <div className="flex h-full w-full overflow-hidden">
      <LeftPane />
      <div className="flex-1 flex flex-col min-w-0">
        <TopRightPane />
        <RightPane />
      </div>
    </div>
  );
}
