/**
 * EntityBrowser - Grouped category navigation sidebar (Browse tab)
 *
 * Features:
 * - Hover-to-expand rail (collapses to icon-only w-14)
 * - Pin to keep expanded
 * - Grouped sections: EXPLORE, DATA FLOW, INTEGRATIONS, MANAGE
 */

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  Table2, BookOpen, GitBranch, ShieldCheck, BarChart3,
  LayoutGrid, Database, Workflow, BarChart2, FileCode,
  HardDrive, Clock, Search, PanelLeftClose, PanelLeft,
  Share2, Boxes, TableProperties, Terminal, Home, Sparkles
} from 'lucide-react';
import {
  SIDEBAR_STYLES,
  RailButton,
  PinButton,
  ResizeHandle,
  SidebarHeader,
  CollapsedRailContainer,
  ExpandedContainer,
} from './ui/SidebarStyles';

// Category definitions matching the screenshot
const CATEGORIES = [
  // HOME - Discovery landing
  { id: 'home', label: 'Explore', icon: Sparkles, group: 'home' },

  // EXPLORE group
  { id: 'core', label: 'Core', icon: Table2, group: 'explore' },
  { id: 'glossary', label: 'Glossary', icon: BookOpen, group: 'explore' },
  { id: 'datamesh', label: 'Data Mesh', icon: Boxes, group: 'explore' },
  { id: 'relational', label: 'Relational DB', icon: TableProperties, group: 'explore' },

  // DATA FLOW group
  { id: 'lineage', label: 'Lineage', icon: GitBranch, group: 'dataflow' },
  { id: 'usage', label: 'Usage', icon: BarChart3, group: 'dataflow' },
  { id: 'queries', label: 'Query Org', icon: FileCode, group: 'dataflow' },

  // INTEGRATIONS group
  { id: 'bi', label: 'BI Tools', icon: BarChart2, group: 'integrations' },
  { id: 'dbt', label: 'dbt', icon: Workflow, group: 'integrations' },
  { id: 'storage', label: 'Object Storage', icon: HardDrive, group: 'integrations' },
  { id: 'orchestration', label: 'Orchestration', icon: Clock, group: 'integrations' },

  // MANAGE group
  { id: 'governance', label: 'Governance', icon: ShieldCheck, group: 'manage' },
];

const GROUPS = [
  { id: 'home', label: 'HOME' },
  { id: 'explore', label: 'BROWSE' },
  { id: 'dataflow', label: 'DATA FLOW' },
  { id: 'integrations', label: 'INTEGRATIONS' },
  { id: 'manage', label: 'MANAGE' },
];

// Category item component
function CategoryItem({ category, isSelected, onClick }) {
  const Icon = category.icon;

  return (
    <button
      type="button"
      onClick={() => onClick(category)}
      className={`
        w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-all
        ${isSelected
          ? 'bg-blue-50 text-blue-700 font-medium'
          : 'text-slate-700 hover:bg-slate-100'
        }
      `}
    >
      <Icon size={18} className={isSelected ? 'text-blue-600' : 'text-slate-500'} />
      <span>{category.label}</span>
    </button>
  );
}

// Group section component
function CategoryGroup({ group, categories, selectedId, onSelect }) {
  const groupCategories = categories.filter(c => c.group === group.id);

  if (groupCategories.length === 0) return null;

  return (
    <div className="mb-4">
      <h3 className="px-3 mb-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">
        {group.label}
      </h3>
      <div className="space-y-0.5">
        {groupCategories.map(category => (
          <CategoryItem
            key={category.id}
            category={category}
            isSelected={selectedId === category.id}
            onClick={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

export default function EntityBrowser({
  database = 'ACME_ANALYTICS',
  schema = 'MDLH',
  onOpenInEditor,
  onCategoryChange,
  selectedCategory = 'core',
}) {
  const [isPinned, setIsPinned] = useState(true); // Start pinned/expanded
  const [isHovered, setIsHovered] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Resize state - use shared constants
  const [navWidth, setNavWidth] = useState(SIDEBAR_STYLES.minExpandedWidth);
  const [isResizing, setIsResizing] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const MIN_WIDTH = SIDEBAR_STYLES.minExpandedWidth;
  const MAX_WIDTH = SIDEBAR_STYLES.maxExpandedWidth;

  const hoverTimeoutRef = useRef(null);
  const navRef = useRef(null);

  // Hover handlers with timeouts
  const handleMouseEnter = useCallback(() => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(true);
    }, 150); // Small delay to prevent accidental triggers
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 300); // Delay before closing
  }, []);

  const togglePin = useCallback(() => {
    setIsPinned(prev => !prev);
  }, []);

  // Resize handlers
  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = navWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [navWidth]);

  const handleResizeMove = useCallback((e) => {
    if (!isResizing) return;
    // For left nav, dragging right increases width
    const delta = e.clientX - startXRef.current;
    const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidthRef.current + delta));
    setNavWidth(newWidth);
  }, [isResizing]);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  // Attach global mouse listeners for resize
  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleResizeMove);
      window.addEventListener('mouseup', handleResizeEnd);
      return () => {
        window.removeEventListener('mousemove', handleResizeMove);
        window.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  // Show expanded when pinned OR hovered
  const isExpanded = isPinned || isHovered;

  // Filter categories by search
  const filteredCategories = useMemo(() => {
    if (!searchQuery) return CATEGORIES;
    const lower = searchQuery.toLowerCase();
    return CATEGORIES.filter(c => c.label.toLowerCase().includes(lower));
  }, [searchQuery]);

  const handleSelect = (category) => {
    onCategoryChange?.(category.id);
  };

  // Rail mode (collapsed) - when not pinned and not hovered
  if (!isExpanded) {
    return (
      <CollapsedRailContainer
        ref={navRef}
        position="left"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Pin indicator at top */}
        <div className="p-2 border-b border-slate-200 flex justify-center">
          <PinButton isPinned={isPinned} onToggle={togglePin} size="md" />
        </div>

        {/* Category icons */}
        <div className="flex-1 overflow-y-auto py-1">
          {CATEGORIES.map(category => (
            <RailButton
              key={category.id}
              icon={category.icon}
              label={category.label}
              isActive={selectedCategory === category.id}
              onClick={() => handleSelect(category)}
              position="left"
            />
          ))}
        </div>

        {/* Query Editor - collapsed */}
        <div className="p-2 border-t border-slate-200">
          <RailButton
            icon={Terminal}
            label="Query Editor"
            isActive={selectedCategory === 'editor'}
            onClick={() => onCategoryChange?.('editor')}
            position="left"
          />
        </div>
      </CollapsedRailContainer>
    );
  }

  // Expanded view (pinned or hovered)
  return (
    <ExpandedContainer
      ref={navRef}
      width={navWidth}
      position="left"
      isResizing={isResizing}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Header with pin toggle */}
      <SidebarHeader
        title="Categories"
        isPinned={isPinned}
        onTogglePin={togglePin}
      />

      {/* Category groups */}
      <div className="flex-1 overflow-y-auto p-2">
        {GROUPS.map(group => (
          <CategoryGroup
            key={group.id}
            group={group}
            categories={filteredCategories}
            selectedId={selectedCategory}
            onSelect={handleSelect}
          />
        ))}
      </div>

      {/* Query Editor - footer */}
      <div className="p-2 border-t border-slate-200 bg-slate-50/50">
        <button
          type="button"
          onClick={() => onCategoryChange?.('editor')}
          className={`
            w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-all
            ${selectedCategory === 'editor'
              ? 'bg-emerald-100 text-emerald-700 font-medium'
              : 'text-emerald-600 hover:bg-emerald-50'
            }
          `}
        >
          <Terminal size={18} />
          <span>Query Editor</span>
        </button>
      </div>

      {/* Resize handle */}
      <ResizeHandle
        position="right"
        isResizing={isResizing}
        onMouseDown={handleResizeStart}
      />
    </ExpandedContainer>
  );
}
