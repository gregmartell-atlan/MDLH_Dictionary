/**
 * EntityPanelContext - Global state for the unified entity panel
 *
 * Provides expand/collapse control from anywhere in the app:
 * - isExpanded: Whether the panel is in expanded (full editor) mode
 * - isPinned: Whether the panel is pinned open (vs hover-only)
 * - isHovered: Whether mouse is over the panel/rail
 * - expand(): Expand the panel
 * - collapse(): Collapse the panel
 * - toggle(): Toggle expanded state
 * - pin(): Pin the panel open
 * - unpin(): Unpin the panel
 * - loadQuery(sql): Load a query and expand
 */

import React, { createContext, useContext, useState, useCallback } from 'react';

const EntityPanelContext = createContext(null);

export function EntityPanelProvider({ children }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [pendingQuery, setPendingQuery] = useState(null);

  const expand = useCallback(() => {
    setIsExpanded(true);
  }, []);

  const collapse = useCallback(() => {
    setIsExpanded(false);
  }, []);

  const toggle = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  const pin = useCallback(() => {
    setIsPinned(true);
    setIsExpanded(true);
  }, []);

  const unpin = useCallback(() => {
    setIsPinned(false);
  }, []);

  const togglePin = useCallback(() => {
    setIsPinned(prev => {
      if (!prev) setIsExpanded(true);
      return !prev;
    });
  }, []);

  const setHovered = useCallback((hovered) => {
    setIsHovered(hovered);
  }, []);

  // Load a query into the editor and expand the panel
  const loadQuery = useCallback((sql, options = {}) => {
    setPendingQuery({ sql, ...options });
    setIsExpanded(true);
    setIsPinned(true); // Pin when loading a query
  }, []);

  // Clear pending query after it's been consumed
  const consumePendingQuery = useCallback(() => {
    const query = pendingQuery;
    setPendingQuery(null);
    return query;
  }, [pendingQuery]);

  // Computed: panel should be visible (expanded or hovered)
  const isVisible = isExpanded || isPinned || isHovered;

  const value = {
    isExpanded,
    isPinned,
    isHovered,
    isVisible,
    expand,
    collapse,
    toggle,
    pin,
    unpin,
    togglePin,
    setHovered,
    loadQuery,
    pendingQuery,
    consumePendingQuery,
  };

  return (
    <EntityPanelContext.Provider value={value}>
      {children}
    </EntityPanelContext.Provider>
  );
}

export function useEntityPanel() {
  const context = useContext(EntityPanelContext);
  if (!context) {
    throw new Error('useEntityPanel must be used within EntityPanelProvider');
  }
  return context;
}

// Optional hook that returns null if no provider (for optional usage)
export function useEntityPanelOptional() {
  return useContext(EntityPanelContext);
}

export default EntityPanelContext;
