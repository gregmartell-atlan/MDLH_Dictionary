/**
 * Query Editor - Main component for SQL editing and execution
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { 
  Play, Square, Trash2, History, Settings, 
  Check, X, Loader2, Database, Clock,
  Wifi, WifiOff, PanelLeft, PanelLeftClose
} from 'lucide-react';
import SchemaExplorer from './SchemaExplorer';
import ResultsTable from './ResultsTable';
import ConnectionModal from './ConnectionModal';
import { useConnection, useQuery, useQueryHistory } from '../hooks/useSnowflake';

function ConnectionBadge({ status, onConnect, loading }) {
  if (loading) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-full text-xs">
        <Loader2 size={12} className="animate-spin" />
        Connecting...
      </div>
    );
  }
  
  if (!status || !status.connected) {
    return (
      <button 
        onClick={onConnect}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs hover:bg-amber-100 font-medium"
      >
        <Database size={12} />
        Configure Connection
      </button>
    );
  }
  
  return (
    <button 
      onClick={onConnect}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-full text-xs hover:bg-green-100"
      title="Click to reconfigure"
    >
      <Wifi size={12} />
      <span>{status.warehouse || 'Connected'}</span>
    </button>
  );
}

function QueryHistoryPanel({ isOpen, onClose, history, onSelectQuery, onRefresh, loading }) {
  if (!isOpen) return null;
  
  return (
    <div className="absolute right-0 top-full mt-2 w-96 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-96 overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-gray-200">
        <h3 className="font-semibold text-gray-700">Query History</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X size={16} />
        </button>
      </div>
      
      <div className="overflow-y-auto max-h-80">
        {history.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            No query history yet
          </div>
        ) : (
          history.map((item, i) => (
            <div 
              key={item.query_id}
              className="p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
              onClick={() => onSelectQuery(item.sql)}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  item.status === 'SUCCESS' ? 'bg-green-100 text-green-700' :
                  item.status === 'FAILED' ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {item.status}
                </span>
                <span className="text-xs text-gray-400">
                  {item.row_count !== null && `${item.row_count} rows`}
                </span>
              </div>
              <code className="text-xs text-gray-600 line-clamp-2 block mt-1">
                {item.sql}
              </code>
              {item.duration_ms && (
                <span className="text-xs text-gray-400 mt-1 block">
                  {(item.duration_ms / 1000).toFixed(2)}s
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function QueryEditor({ initialQuery = '', onClose }) {
  const editorRef = useRef(null);
  const [sql, setSql] = useState(initialQuery);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  
  const { status: connStatus, testConnection, loading: connLoading } = useConnection();
  const { executeQuery, results, loading: queryLoading, error: queryError, clearResults } = useQuery();
  const { history, fetchHistory, loading: historyLoading } = useQueryHistory();
  const [connectionStatus, setConnectionStatus] = useState(null);
  
  // Try to connect on mount (will fail gracefully if no env config)
  useEffect(() => {
    testConnection().then(status => {
      setConnectionStatus(status);
      // If not connected, show modal automatically
      if (!status?.connected) {
        setShowConnectionModal(true);
      }
    });
    fetchHistory();
  }, []);
  
  // Handle successful connection from modal
  const handleConnectionSuccess = (status) => {
    setConnectionStatus(status);
    setShowConnectionModal(false);
  };
  
  // Update SQL when initialQuery changes
  useEffect(() => {
    if (initialQuery) {
      setSql(initialQuery);
    }
  }, [initialQuery]);
  
  // Handle editor mount
  const handleEditorMount = (editor, monaco) => {
    editorRef.current = editor;
    
    // Add keyboard shortcut for execute
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      handleExecute();
    });
    
    // Focus editor
    editor.focus();
  };
  
  // Execute query
  const handleExecute = useCallback(async () => {
    const queryText = sql.trim();
    if (!queryText) return;
    
    await executeQuery(queryText, {
      database: connStatus?.database,
      schema: connStatus?.schema,
      warehouse: connStatus?.warehouse
    });
    
    // Refresh history after execution
    fetchHistory();
  }, [sql, connStatus, executeQuery, fetchHistory]);
  
  // Insert text at cursor
  const handleInsertText = useCallback((text) => {
    if (editorRef.current) {
      const editor = editorRef.current;
      const selection = editor.getSelection();
      const id = { major: 1, minor: 1 };
      const op = {
        identifier: id,
        range: selection,
        text: text,
        forceMoveMarkers: true
      };
      editor.executeEdits("insertText", [op]);
      editor.focus();
    }
  }, []);
  
  // Clear editor
  const handleClear = () => {
    setSql('');
    clearResults();
    editorRef.current?.focus();
  };
  
  // Load query from history
  const handleSelectHistoryQuery = (query) => {
    setSql(query);
    setShowHistory(false);
    editorRef.current?.focus();
  };
  
  return (
    <div className="flex flex-col h-[calc(100vh-300px)] min-h-[500px] bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="p-2 hover:bg-gray-200 rounded text-gray-500"
            title={showSidebar ? 'Hide schema browser' : 'Show schema browser'}
          >
            {showSidebar ? <PanelLeftClose size={16} /> : <PanelLeft size={16} />}
          </button>
          
          <div className="h-4 w-px bg-gray-300" />
          
          <button
            onClick={handleExecute}
            disabled={queryLoading || !sql.trim()}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-[#3366FF] hover:bg-blue-600 text-white rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {queryLoading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Play size={14} />
            )}
            Run
          </button>
          
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-gray-200 text-gray-600 rounded text-sm"
          >
            <Trash2 size={14} />
            Clear
          </button>
          
          <div className="relative">
            <button
              onClick={() => {
                setShowHistory(!showHistory);
                if (!showHistory) fetchHistory();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-gray-200 text-gray-600 rounded text-sm"
            >
              <History size={14} />
              History
            </button>
            
            <QueryHistoryPanel
              isOpen={showHistory}
              onClose={() => setShowHistory(false)}
              history={history}
              onSelectQuery={handleSelectHistoryQuery}
              onRefresh={fetchHistory}
              loading={historyLoading}
            />
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <ConnectionBadge 
            status={connectionStatus} 
            onConnect={() => setShowConnectionModal(true)} 
            loading={connLoading}
          />
          
          <span className="text-xs text-gray-400">
            ⌘+Enter to run
          </span>
        </div>
      </div>
      
      {/* Connection Modal */}
      <ConnectionModal
        isOpen={showConnectionModal}
        onClose={() => setShowConnectionModal(false)}
        onConnect={handleConnectionSuccess}
        currentStatus={connectionStatus}
      />
      
      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Schema Browser */}
        {showSidebar && (
          <div className="w-64 flex-shrink-0 border-r border-gray-200">
            <SchemaExplorer 
              onInsertText={handleInsertText}
              defaultDatabase={connStatus?.database}
              isConnected={connectionStatus?.connected}
            />
          </div>
        )}
        
        {/* Editor + Results */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* SQL Editor */}
          <div className="h-1/2 border-b border-gray-200">
            <Editor
              height="100%"
              defaultLanguage="sql"
              value={sql}
              onChange={(value) => setSql(value || '')}
              onMount={handleEditorMount}
              theme="vs"
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                automaticLayout: true,
                tabSize: 2,
                padding: { top: 10 },
                suggestOnTriggerCharacters: true,
              }}
            />
          </div>
          
          {/* Results */}
          <div className="h-1/2 overflow-hidden">
            <ResultsTable
              results={results}
              loading={queryLoading}
              error={queryError}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

