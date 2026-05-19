import LeftPane from '@/layout/LeftPane';
import TopRightPane from '@/layout/TopRightPane';
import RightPane from '@/layout/RightPane';
import RightCornerSidebar from '@/layout/RightCornerSidebar';
import RightSidebarDrawer from '@/layout/RightSidebarDrawer';

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
        <div className="flex min-h-0 flex-1">
          <RightPane />
          <RightCornerSidebar />
        </div>
      </div>
      <RightSidebarDrawer />
    </div>
  );
}
