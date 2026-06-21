import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type SearchResultsDropdownProps = {
  /** The element the dropdown is anchored to (the search input wrapper). */
  anchorRef: React.RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

type Position = { top: number; left: number; width: number };

/**
 * Renders workspace search results in a body-level portal with fixed
 * positioning, anchored under the search input. Because it escapes every local
 * stacking context (cards, sticky headers, transformed rows), the results always
 * paint above the rest of the workspace — fixing dropdowns that previously hid
 * behind line-item action icons or sibling section cards. Closes on outside click
 * and on scroll/resize.
 */
const SearchResultsDropdown = ({
  anchorRef,
  open,
  onClose,
  children,
}: SearchResultsDropdownProps) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<Position | null>(null);

  // Close when a press lands outside BOTH the anchor and the portal panel.
  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (anchorRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [open, anchorRef, onClose]);

  useEffect(() => {
    if (!open) {
      setPosition(null);
      return undefined;
    }
    const measure = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (rect) setPosition({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    };
    measure();
    // Reposition while open; close on scroll so it never floats detached.
    const handleScroll = () => onClose();
    globalThis.window.addEventListener('resize', measure);
    globalThis.window.addEventListener('scroll', handleScroll, true);
    return () => {
      globalThis.window.removeEventListener('resize', measure);
      globalThis.window.removeEventListener('scroll', handleScroll, true);
    };
  }, [open, anchorRef, onClose]);

  if (!open || !position || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        width: position.width,
        zIndex: 1000,
      }}
      className="max-h-80 overflow-auto rounded-2xl border border-card-border bg-neutral-0 shadow-[0_1px_3px_1px_rgba(0,0,0,0.15)]"
    >
      {children}
    </div>,
    document.body
  );
};

export default SearchResultsDropdown;
