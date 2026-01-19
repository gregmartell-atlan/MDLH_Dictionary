/**
 * EntityPanelContext - Global state for the unified entity panel
 *
 * Provides expand/collapse control from anywhere in the app:
 * - isExpanded: Whether the panel is in expanded (full editor) mode
 * - isPinned: Whether the panel is pinned open
 * - expand(): Expand the panel
 * - collapse(): Collapse the panel
 * - toggle(): Toggle expanded state
 * - pin(): Pin the panel open
 * - unpin(): Unpin the panel
 * - loadQuery(sql): Load a query and expand
 *
 * Note: Hover behavior removed - panel now uses explicit expand/collapse buttons only
 */

import React, { createContext, useContext, useState, useCallback } from 'react';

const EntityPanelContext = createContext(null);

export function EntityPanelProvider({ children }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [pendingQuery, setPendingQuery] = useState(null);
  const [pendingTab, setPendingTab] = useState(null); // Tab to switch to

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

  // Load a query into the editor and expand the panel
  const loadQuery = useCallback((sql, options = {}) => {
    setPendingQuery({ sql, ...options });
    setIsExpanded(true);
    setIsPinned(true); // Pin when loading a query
  }, []);

  // Open panel to a specific tab
  const openToTab = useCallback((tab) => {
    setPendingTab(tab);
    setIsExpanded(true);
    setIsPinned(true);
  }, []);

  // Clear pending query after it's been consumed
  const consumePendingQuery = useCallback(() => {
    const query = pendingQuery;
    setPendingQuery(null);
    return query;
  }, [pendingQuery]);

  // Clear pending tab after it's been consumed
  const consumePendingTab = useCallback(() => {
    const tab = pendingTab;
    setPendingTab(null);
    return tab;
  }, [pendingTab]);

  // Computed: panel should be visible when pinned or expanded
  const isVisible = isPinned || isExpanded;
  const showPanel = isPinned || isExpanded;

  const value = {
    isExpanded,
    isPinned,
    isVisible,
    showPanel,
    expand,
    collapse,
    toggle,
    pin,
    unpin,
    togglePin,
    loadQuery,
    openToTab,
    pendingQuery,
    pendingTab,
    consumePendingQuery,
    consumePendingTab,
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
