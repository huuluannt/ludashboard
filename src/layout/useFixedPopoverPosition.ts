import { type CSSProperties, type RefObject, useCallback, useEffect, useState } from 'react';

interface FixedPopoverPositionOptions {
  anchorRef: RefObject<HTMLElement | null>;
  open: boolean;
  panelMaxWidth: number;
  margin?: number;
  offset?: number;
}

const HIDDEN_STYLE: CSSProperties = {
  left: 0,
  top: 0,
  visibility: 'hidden',
};

export function useFixedPopoverPosition({
  anchorRef,
  open,
  panelMaxWidth,
  margin = 8,
  offset = 4,
}: FixedPopoverPositionOptions) {
  const [style, setStyle] = useState<CSSProperties>(HIDDEN_STYLE);

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!open || !anchor) {
      setStyle(HIDDEN_STYLE);
      return;
    }

    const rect = anchor.getBoundingClientRect();
    const availableWidth = Math.max(0, window.innerWidth - margin * 2);
    const width = Math.min(panelMaxWidth, availableWidth);
    const maxLeft = window.innerWidth - width - margin;
    const preferredLeft = rect.right - width;
    const left = Math.min(Math.max(margin, preferredLeft), maxLeft);

    setStyle({
      left: Math.round(left),
      top: Math.round(rect.bottom + offset),
      width,
      visibility: 'visible',
    });
  }, [anchorRef, margin, offset, open, panelMaxWidth]);

  useEffect(() => {
    if (!open) {
      setStyle(HIDDEN_STYLE);
      return undefined;
    }

    updatePosition();
    const frame = window.requestAnimationFrame(updatePosition);

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, updatePosition]);

  return style;
}
