import React, { useState, useEffect, useRef } from 'react';
import { Code2, X } from 'lucide-react';
import { CopyButton } from './CopyButton';

// Individual query card component
export function QueryCard({ title, description, query, defaultExpanded = false }) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className={`bg-white rounded-xl border overflow-hidden transition-all duration-200 ${
      expanded ? 'border-[#3366FF] shadow-lg' : 'border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300'
    }`}>
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#3366FF]/10 rounded-lg">
            <Code2 size={18} className="text-[#3366FF]" />
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 text-sm">{title}</h4>
            <p className="text-gray-500 text-xs mt-0.5">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <CopyButton text={query} />
          <div className={`w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}>
            <span className="text-gray-500 text-xs">&#9654;</span>
          </div>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-gray-100 p-4 bg-gray-50">
          <pre className="text-xs text-gray-800 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed p-4 bg-white rounded-lg border border-gray-200">
            {query}
          </pre>
        </div>
      )}
    </div>
  );
}

// Play button for entity rows
export function PlayQueryButton({ onClick, hasQuery }) {
  if (!hasQuery) return null;

  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#3366FF] hover:bg-blue-600 text-white transition-all duration-200 shadow-sm hover:shadow-md"
      title="View query"
    >
      <Code2 size={12} />
      <span>Query</span>
    </button>
  );
}

// Slide-out Query Panel
export function QueryPanel({ isOpen, onClose, queries, categoryLabel, highlightedQuery }) {
  const panelRef = useRef(null);
  const highlightedRef = useRef(null);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target) && isOpen) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  // Scroll to highlighted query when panel opens
  useEffect(() => {
    if (isOpen && highlightedQuery && highlightedRef.current) {
      setTimeout(() => {
        highlightedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 350);
    }
  }, [isOpen, highlightedQuery]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={`fixed top-0 right-0 h-full w-full max-w-2xl bg-white border-l border-gray-200 shadow-2xl z-50 transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Panel Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-[#3366FF]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Code2 size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Example Queries</h2>
              <p className="text-sm text-blue-100">{categoryLabel} &bull; {queries.length} queries</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/20 text-white transition-colors"
            title="Close (Esc)"
          >
            <X size={20} />
          </button>
        </div>

        {/* Panel Content */}
        <div className="overflow-y-auto h-[calc(100%-80px)] p-4 space-y-3 bg-gray-50">
          {/* Show highlighted inline query at top if it's not in the main queries */}
          {highlightedQuery && !queries.some(q => q.query === highlightedQuery) && (
            <div ref={highlightedRef}>
              <div className="mb-4 pb-4 border-b border-gray-200">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-medium">Entity Example Query</p>
                <QueryCard
                  title="Entity Query"
                  description="Example query for this entity type"
                  query={highlightedQuery}
                  defaultExpanded={true}
                />
              </div>
            </div>
          )}

          {queries.length > 0 ? (
            <>
              {highlightedQuery && !queries.some(q => q.query === highlightedQuery) && (
                <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">More {categoryLabel} Queries</p>
              )}
              {queries.map((q, i) => {
                const isHighlighted = highlightedQuery && q.query === highlightedQuery;
                return (
                  <div key={i} ref={isHighlighted ? highlightedRef : null}>
                    <QueryCard
                      title={q.title}
                      description={q.description}
                      query={q.query}
                      defaultExpanded={isHighlighted}
                    />
                  </div>
                );
              })}
            </>
          ) : !highlightedQuery ? (
            <div className="text-center py-16">
              <Code2 size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-600 font-medium">No queries available</p>
              <p className="text-gray-400 text-sm mt-1">Queries for this category are coming soon</p>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
