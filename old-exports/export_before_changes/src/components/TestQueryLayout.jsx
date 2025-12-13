/**
 * TestQueryLayout - Layout component for the "Test Query" mode in the flyout panel
 * 
 * Provides a single header with gradient styling and embeds the FlyoutQueryEditor
 * without duplicate headers.
 */

import React from 'react';
import { ArrowLeft, FlaskConical, X } from 'lucide-react';
import FlyoutQueryEditor from './FlyoutQueryEditor';

export default function TestQueryLayout({
  testQueryMode,
  onBack,
  onClose,
  onOpenFullEditor,
  selectedDatabase,
  selectedSchema,
  // Pass through to check for unsaved changes
  onSqlChange = null,
  // Schema info for suggestions
  availableTables = [],
  tableColumns = {}
}) {
  return (
    <>
      {/* Test Mode Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-emerald-500 to-teal-500 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
            title="Back to queries"
          >
            <ArrowLeft size={18} className="text-white" />
          </button>
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <FlaskConical size={18} />
              Test Query
            </h2>
            <p className="text-sm text-emerald-100">
              {testQueryMode.title || 'Run this query against your MDLH connection.'}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-white/20 text-white transition-colors"
          title="Close (Esc)"
        >
          <X size={18} />
        </button>
      </header>

      {/* Editor + results - FlyoutQueryEditor handles everything else */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <FlyoutQueryEditor
          title={testQueryMode.title}
          initialQuery={testQueryMode.query}
          database={selectedDatabase}
          schema={selectedSchema}
          onOpenFullEditor={onOpenFullEditor}
          onClose={onBack}
          // Hide the internal header since we have the Test Mode header above
          hideHeader={true}
          onSqlChange={onSqlChange}
          // Schema info for smart suggestions
          availableTables={availableTables}
          tableColumns={tableColumns}
        />
      </div>
    </>
  );
}

