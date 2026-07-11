import { useRef, useState } from 'react';
import type { PointerEvent, TouchEvent } from 'react';
import LeftPane from '@/layout/LeftPane';
import TopRightPane from '@/layout/TopRightPane';
import RightPane from '@/layout/RightPane';
import RightCornerSidebar from '@/layout/RightCornerSidebar';
import RightSidebarDrawer from '@/layout/RightSidebarDrawer';
import { useSidebarStore } from '@/state/sidebarStore';

const SIDEBAR_EXPANDED_WIDTH = 264;
const SIDEBAR_EDGE_SWIPE_WIDTH = 28;
const SIDEBAR_OPEN_SWIPE_MIN_DISTANCE = 64;
const MOBILE_SIDEBAR_QUERY = '(max-width: 768px)';
const isMobileSidebarViewport = () => window.matchMedia?.(MOBILE_SIDEBAR_QUERY).matches ?? false;

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
  const sidebarCollapsed = useSidebarStore((s) => s.collapsed);
  const setSidebarCollapsed = useSidebarStore((s) => s.setCollapsed);
  const sidebarOpenSwipeRef = useRef<{
    pointerId?: number;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    swiping: boolean;
  } | null>(null);
  const [sidebarOpenSwipeActive, setSidebarOpenSwipeActive] = useState(false);
  const [sidebarOpenSwipeOffset, setSidebarOpenSwipeOffset] = useState(-SIDEBAR_EXPANDED_WIDTH);

  const startSidebarOpenSwipe = (clientX: number, clientY: number, pointerId?: number) => {
    sidebarOpenSwipeRef.current = {
      pointerId,
      startX: clientX,
      startY: clientY,
      currentX: clientX,
      currentY: clientY,
      swiping: false,
    };
  };

  const updateSidebarOpenSwipe = (clientX: number, clientY: number) => {
    const swipe = sidebarOpenSwipeRef.current;
    if (!swipe) return false;

    swipe.currentX = clientX;
    swipe.currentY = clientY;

    const deltaX = swipe.currentX - swipe.startX;
    const deltaY = swipe.currentY - swipe.startY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (!swipe.swiping && absX < 10 && absY < 10) return false;
    if (!swipe.swiping && (deltaX <= 0 || absY > absX)) {
      sidebarOpenSwipeRef.current = null;
      setSidebarOpenSwipeActive(false);
      setSidebarOpenSwipeOffset(-SIDEBAR_EXPANDED_WIDTH);
      return false;
    }

    swipe.swiping = true;
    setSidebarOpenSwipeActive(true);
    setSidebarOpenSwipeOffset(Math.min(0, Math.max(-SIDEBAR_EXPANDED_WIDTH + deltaX, -SIDEBAR_EXPANDED_WIDTH)));
    return true;
  };

  const finishSidebarOpenSwipe = () => {
    const swipe = sidebarOpenSwipeRef.current;
    if (!swipe) return;

    const deltaX = swipe.currentX - swipe.startX;
    const deltaY = swipe.currentY - swipe.startY;
    const shouldOpen = deltaX >= SIDEBAR_OPEN_SWIPE_MIN_DISTANCE && Math.abs(deltaX) > Math.abs(deltaY) * 1.2;

    sidebarOpenSwipeRef.current = null;
    setSidebarOpenSwipeActive(false);
    setSidebarOpenSwipeOffset(-SIDEBAR_EXPANDED_WIDTH);
    if (shouldOpen) setSidebarCollapsed(false);
  };

  const handleShellPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!sidebarCollapsed || sidebarOpenSwipeRef.current || event.pointerType === 'mouse') return;
    if (!isMobileSidebarViewport() || event.clientX > SIDEBAR_EDGE_SWIPE_WIDTH) return;

    startSidebarOpenSwipe(event.clientX, event.clientY, event.pointerId);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleShellPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const swipe = sidebarOpenSwipeRef.current;
    if (!swipe || swipe.pointerId !== event.pointerId) return;

    if (updateSidebarOpenSwipe(event.clientX, event.clientY)) {
      event.preventDefault();
      return;
    }

    if (!sidebarOpenSwipeRef.current && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleShellPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    const swipe = sidebarOpenSwipeRef.current;
    if (!swipe || swipe.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    finishSidebarOpenSwipe();
  };

  const handleShellTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (!sidebarCollapsed || sidebarOpenSwipeRef.current) return;
    if (!isMobileSidebarViewport() || event.touches.length !== 1) return;

    const touch = event.touches[0];
    if (touch.clientX > SIDEBAR_EDGE_SWIPE_WIDTH) return;
    startSidebarOpenSwipe(touch.clientX, touch.clientY);
  };

  const handleShellTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    const swipe = sidebarOpenSwipeRef.current;
    if (!swipe || swipe.pointerId != null || event.touches.length !== 1) return;

    const touch = event.touches[0];
    if (updateSidebarOpenSwipe(touch.clientX, touch.clientY)) event.preventDefault();
  };

  const handleShellTouchEnd = () => {
    const swipe = sidebarOpenSwipeRef.current;
    if (!swipe || swipe.pointerId != null) return;
    finishSidebarOpenSwipe();
  };

  return (
    <div
      className="flex h-full w-full overflow-hidden"
      onPointerCancelCapture={handleShellPointerEnd}
      onPointerDownCapture={handleShellPointerDown}
      onPointerMoveCapture={handleShellPointerMove}
      onPointerUpCapture={handleShellPointerEnd}
      onTouchCancelCapture={handleShellTouchEnd}
      onTouchEndCapture={handleShellTouchEnd}
      onTouchMoveCapture={handleShellTouchMove}
      onTouchStartCapture={handleShellTouchStart}
    >
      {sidebarCollapsed && <div className="mobile-sidebar-edge-swipe-zone" aria-hidden="true" />}
      <LeftPane openingSwipeActive={sidebarOpenSwipeActive} openingSwipeOffset={sidebarOpenSwipeOffset} />
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
