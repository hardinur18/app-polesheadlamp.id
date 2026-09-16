import * as React from 'react';

import { cn } from './utils';

export const HORIZONTAL_DRAG_SCROLL_INTERACTIVE_SELECTOR =
  'button, a, input, textarea, select, [data-slot="checkbox"], [role="menuitem"], [contenteditable="true"], [data-drag-scroll-ignore="true"]';

type HorizontalDragScrollState = {
  active: boolean;
  dragging: boolean;
  pointerId: number | null;
  scrollLeft: number;
  startX: number;
};

type HorizontalDragScrollOptions<T extends HTMLElement> = {
  enabled?: boolean;
  interactiveSelector?: string;
  threshold?: number;
  onClickCapture?: React.MouseEventHandler<T>;
  onPointerCancel?: React.PointerEventHandler<T>;
  onPointerDown?: React.PointerEventHandler<T>;
  onPointerLeave?: React.PointerEventHandler<T>;
  onPointerMove?: React.PointerEventHandler<T>;
  onPointerUp?: React.PointerEventHandler<T>;
};

export function useHorizontalDragScroll<T extends HTMLElement>({
  enabled = true,
  interactiveSelector = HORIZONTAL_DRAG_SCROLL_INTERACTIVE_SELECTOR,
  threshold = 8,
  onClickCapture,
  onPointerCancel,
  onPointerDown,
  onPointerLeave,
  onPointerMove,
  onPointerUp,
}: HorizontalDragScrollOptions<T>) {
  const dragStateRef = React.useRef<HorizontalDragScrollState>({
    active: false,
    dragging: false,
    pointerId: null,
    scrollLeft: 0,
    startX: 0,
  });
  const suppressClickRef = React.useRef(false);

  const resetDragScroll = React.useCallback((target: T, pointerId?: number) => {
    if (pointerId !== undefined && target.hasPointerCapture?.(pointerId)) {
      target.releasePointerCapture(pointerId);
    }

    target.removeAttribute('data-dragging');
    dragStateRef.current.active = false;
    dragStateRef.current.dragging = false;
    dragStateRef.current.pointerId = null;
  }, []);

  const isInteractiveTarget = React.useCallback(
    (target: EventTarget | null) => {
      return target instanceof HTMLElement && Boolean(target.closest(interactiveSelector));
    },
    [interactiveSelector],
  );

  const handleClickCapture = React.useCallback(
    (event: React.MouseEvent<T>) => {
      if (enabled && (suppressClickRef.current || dragStateRef.current.dragging)) {
        event.preventDefault();
        event.stopPropagation();
        suppressClickRef.current = false;
        return;
      }

      onClickCapture?.(event);
    },
    [enabled, onClickCapture],
  );

  const handlePointerDown = React.useCallback(
    (event: React.PointerEvent<T>) => {
      onPointerDown?.(event);
      if (!enabled || event.defaultPrevented) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      if (isInteractiveTarget(event.target)) return;

      const scroller = event.currentTarget;
      if (scroller.scrollWidth <= scroller.clientWidth) return;

      suppressClickRef.current = false;
      dragStateRef.current = {
        active: true,
        dragging: false,
        pointerId: event.pointerId,
        scrollLeft: scroller.scrollLeft,
        startX: event.clientX,
      };
      scroller.setPointerCapture?.(event.pointerId);
    },
    [enabled, isInteractiveTarget, onPointerDown],
  );

  const handlePointerMove = React.useCallback(
    (event: React.PointerEvent<T>) => {
      const dragState = dragStateRef.current;
      if (enabled && dragState.active && dragState.pointerId === event.pointerId) {
        const deltaX = event.clientX - dragState.startX;
        if (Math.abs(deltaX) > Math.max(0, threshold)) {
          dragState.dragging = true;
          suppressClickRef.current = true;
          event.currentTarget.setAttribute('data-dragging', 'true');
          event.preventDefault();
          event.currentTarget.scrollLeft = dragState.scrollLeft - deltaX;
        }
      }

      if (!event.defaultPrevented) {
        onPointerMove?.(event);
      }
    },
    [enabled, onPointerMove, threshold],
  );

  const handleDragPointerEnd = React.useCallback(
    (event: React.PointerEvent<T>) => {
      const dragState = dragStateRef.current;
      if (!enabled || !dragState.active || dragState.pointerId !== event.pointerId) return;

      if (dragState.dragging) {
        suppressClickRef.current = true;
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 0);
      }

      resetDragScroll(event.currentTarget, event.pointerId);
    },
    [enabled, resetDragScroll],
  );

  const handlePointerUp = React.useCallback(
    (event: React.PointerEvent<T>) => {
      handleDragPointerEnd(event);
      if (!event.defaultPrevented) {
        onPointerUp?.(event);
      }
    },
    [handleDragPointerEnd, onPointerUp],
  );

  const handlePointerCancel = React.useCallback(
    (event: React.PointerEvent<T>) => {
      handleDragPointerEnd(event);
      if (!event.defaultPrevented) {
        onPointerCancel?.(event);
      }
    },
    [handleDragPointerEnd, onPointerCancel],
  );

  const handlePointerLeave = React.useCallback(
    (event: React.PointerEvent<T>) => {
      handleDragPointerEnd(event);
      if (!event.defaultPrevented) {
        onPointerLeave?.(event);
      }
    },
    [handleDragPointerEnd, onPointerLeave],
  );

  return {
    onClickCapture: handleClickCapture,
    onPointerCancel: handlePointerCancel,
    onPointerDown: handlePointerDown,
    onPointerLeave: handlePointerLeave,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
  };
}

type HorizontalDragScrollAreaProps = React.HTMLAttributes<HTMLDivElement> & {
  dragScroll?: boolean;
  dragScrollInteractiveSelector?: string;
  dragScrollThreshold?: number;
};

export const HorizontalDragScrollArea = React.forwardRef<HTMLDivElement, HorizontalDragScrollAreaProps>(
  (
    {
      children,
      className,
      dragScroll = true,
      dragScrollInteractiveSelector = HORIZONTAL_DRAG_SCROLL_INTERACTIVE_SELECTOR,
      dragScrollThreshold = 8,
      onClickCapture,
      onPointerCancel,
      onPointerDown,
      onPointerLeave,
      onPointerMove,
      onPointerUp,
      ...props
    },
    ref,
  ) => {
    const dragHandlers = useHorizontalDragScroll<HTMLDivElement>({
      enabled: dragScroll,
      interactiveSelector: dragScrollInteractiveSelector,
      threshold: dragScrollThreshold,
      onClickCapture,
      onPointerCancel,
      onPointerDown,
      onPointerLeave,
      onPointerMove,
      onPointerUp,
    });

    return (
      <div
        ref={ref}
        className={cn(dragScroll && 'uiHorizontalDragScrollArea', className)}
        {...props}
        {...dragHandlers}
      >
        {children}
      </div>
    );
  },
);
HorizontalDragScrollArea.displayName = 'HorizontalDragScrollArea';
