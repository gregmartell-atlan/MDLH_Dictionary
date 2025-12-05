/**
 * Schema Explorer - Tree browser for databases, schemas, tables, and columns
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  ChevronRight, ChevronDown, Database, FolderClosed, Table2, 
  Eye, Columns, RefreshCw, Loader2 
} from 'lucide-react';
import { useMetadata } from '../hooks/useSnowflake';

function TreeNode({ 
  icon: Icon, 
  label, 
  type,
  isExpanded, 
  isLoading,
  hasChildren,
  onClick, 
  onToggle,
  onInsert,
  children,
  level = 0
}) {
  const paddingLeft = 12 + (level * 16);
  
  return (
    <div className="select-none">
      <div 
        className="flex items-center gap-1 py-1.5 px-2 hover:bg-gray-100 rounded cursor-pointer group"
        style={{ paddingLeft }}
        onClick={(e) => {
          e.stopPropagation();
          if (hasChildren) {
            onToggle?.();
          } else {
            onClick?.();
          }
        }}
      >
        {hasChildren ? (
          <button 
            className="p-0.5 hover:bg-gray-200 rounded"
            onClick={(e) => {
              e.stopPropagation();
              onToggle?.();
            }}
          >
            {isLoading ? (
              <Loader2 size={14} className="text-gray-400 animate-spin" />
            ) : isExpanded ? (
              <ChevronDown size={14} className="text-gray-400" />
            ) : (
              <ChevronRight size={14} className="text-gray-400" />
            )}
          </button>
        ) : (
          <span className="w-5" />
        )}
        
        <Icon size={14} className={
          type === 'database' ? 'text-blue-500' :
          type === 'schema' ? 'text-purple-500' :
          type === 'table' ? 'text-emerald-500' :
          type === 'view' ? 'text-amber-500' :
          'text-gray-400'
        } />
        
        <span className="text-sm text-gray-700 truncate flex-1">{label}</span>
        
        {onInsert && (
          <button 
            className="opacity-0 group-hover:opacity-100 text-xs text-blue-500 hover:text-blue-700 px-1"
            onClick={(e) => {
              e.stopPropagation();
              onInsert();
            }}
          >
            Insert
          </button>
        )}
      </div>
      
      {isExpanded && children && (
        <div>{children}</div>
      )}
    </div>
  );
}

function ColumnNode({ column, level, onInsert }) {
  const typeColors = {
    'VARCHAR': 'text-green-600',
    'NUMBER': 'text-blue-600',
    'BOOLEAN': 'text-purple-600',
    'DATE': 'text-orange-600',
    'TIMESTAMP': 'text-orange-600',
    'VARIANT': 'text-pink-600',
    'ARRAY': 'text-pink-600',
    'OBJECT': 'text-pink-600',
  };
  
  const dataType = column.data_type || column.type || 'UNKNOWN';
  const baseType = dataType.split('(')[0].toUpperCase();
  const typeColor = typeColors[baseType] || 'text-gray-500';
  
  return (
    <div 
      className="flex items-center gap-1 py-1 px-2 hover:bg-gray-100 rounded cursor-pointer group"
      style={{ paddingLeft: 12 + (level * 16) }}
      onClick={() => onInsert?.(column.name)}
    >
      <span className="w-5" />
      <Columns size={12} className="text-gray-400" />
      <span className="text-sm text-gray-700 truncate">{column.name}</span>
      <span className={`text-xs ${typeColor} ml-auto`}>
        {column.data_type}
      </span>
      {!column.nullable && (
        <span className="text-xs text-red-400 ml-1">NOT NULL</span>
      )}
    </div>
  );
}

export default function SchemaExplorer({ onInsertText, defaultDatabase, isConnected }) {
  const { fetchDatabases, fetchSchemas, fetchTables, fetchColumns, refreshCache, loading } = useMetadata();
  
  const [databases, setDatabases] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [schemas, setSchemas] = useState({});
  const [tables, setTables] = useState({});
  const [columns, setColumns] = useState({});
  const [loadingNodes, setLoadingNodes] = useState({});
  
  // Load databases on mount and when connection changes
  useEffect(() => {
    loadDatabases();
  }, [isConnected]);
  
  // Expand default database
  useEffect(() => {
    if (defaultDatabase && databases.length > 0) {
      const db = databases.find(d => d.name === defaultDatabase);
      if (db && !expanded[`db:${db.name}`]) {
        toggleDatabase(db.name);
      }
    }
  }, [defaultDatabase, databases]);
  
  const loadDatabases = async () => {
    const data = await fetchDatabases();
    setDatabases(data);
  };
  
  const toggleDatabase = async (dbName) => {
    const key = `db:${dbName}`;
    
    if (expanded[key]) {
      setExpanded(prev => ({ ...prev, [key]: false }));
      return;
    }
    
    setLoadingNodes(prev => ({ ...prev, [key]: true }));
    const schemaList = await fetchSchemas(dbName);
    setSchemas(prev => ({ ...prev, [dbName]: schemaList }));
    setExpanded(prev => ({ ...prev, [key]: true }));
    setLoadingNodes(prev => ({ ...prev, [key]: false }));
  };
  
  const toggleSchema = async (dbName, schemaName) => {
    const key = `schema:${dbName}.${schemaName}`;
    
    if (expanded[key]) {
      setExpanded(prev => ({ ...prev, [key]: false }));
      return;
    }
    
    setLoadingNodes(prev => ({ ...prev, [key]: true }));
    const tableList = await fetchTables(dbName, schemaName);
    setTables(prev => ({ ...prev, [`${dbName}.${schemaName}`]: tableList }));
    setExpanded(prev => ({ ...prev, [key]: true }));
    setLoadingNodes(prev => ({ ...prev, [key]: false }));
  };
  
  const toggleTable = async (dbName, schemaName, tableName) => {
    const key = `table:${dbName}.${schemaName}.${tableName}`;
    
    if (expanded[key]) {
      setExpanded(prev => ({ ...prev, [key]: false }));
      return;
    }
    
    setLoadingNodes(prev => ({ ...prev, [key]: true }));
    const columnList = await fetchColumns(dbName, schemaName, tableName);
    setColumns(prev => ({ ...prev, [`${dbName}.${schemaName}.${tableName}`]: columnList }));
    setExpanded(prev => ({ ...prev, [key]: true }));
    setLoadingNodes(prev => ({ ...prev, [key]: false }));
  };
  
  const handleRefresh = async () => {
    await refreshCache();
    setSchemas({});
    setTables({});
    setColumns({});
    setExpanded({});
    await loadDatabases();
  };
  
  const insertText = (text) => {
    onInsertText?.(text);
  };
  
  return (
    <div className="h-full flex flex-col bg-white border-r border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200">
        <h3 className="font-semibold text-gray-700 text-sm">Schema Browser</h3>
        <button 
          onClick={handleRefresh}
          className="p-1.5 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-700"
          title="Refresh metadata"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
      
      {/* Tree */}
      <div className="flex-1 overflow-y-auto p-2">
        {databases.length === 0 && !loading ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            <Database size={32} className="mx-auto mb-2 opacity-50" />
            <p>No databases available</p>
            <p className="text-xs mt-1">Connect to Snowflake to browse</p>
          </div>
        ) : (
          databases.map(db => (
            <TreeNode
              key={db.name}
              icon={Database}
              label={db.name}
              type="database"
              isExpanded={expanded[`db:${db.name}`]}
              isLoading={loadingNodes[`db:${db.name}`]}
              hasChildren={true}
              onToggle={() => toggleDatabase(db.name)}
              onInsert={() => insertText(db.name)}
              level={0}
            >
              {schemas[db.name]?.map(schema => (
                <TreeNode
                  key={schema.name}
                  icon={FolderClosed}
                  label={schema.name}
                  type="schema"
                  isExpanded={expanded[`schema:${db.name}.${schema.name}`]}
                  isLoading={loadingNodes[`schema:${db.name}.${schema.name}`]}
                  hasChildren={true}
                  onToggle={() => toggleSchema(db.name, schema.name)}
                  onInsert={() => insertText(`${db.name}.${schema.name}`)}
                  level={1}
                >
                  {tables[`${db.name}.${schema.name}`]?.map(table => (
                    <TreeNode
                      key={table.name}
                      icon={table.kind === 'VIEW' ? Eye : Table2}
                      label={table.name}
                      type={table.kind === 'VIEW' ? 'view' : 'table'}
                      isExpanded={expanded[`table:${db.name}.${schema.name}.${table.name}`]}
                      isLoading={loadingNodes[`table:${db.name}.${schema.name}.${table.name}`]}
                      hasChildren={true}
                      onToggle={() => toggleTable(db.name, schema.name, table.name)}
                      onInsert={() => insertText(`${db.name}.${schema.name}.${table.name}`)}
                      level={2}
                    >
                      {columns[`${db.name}.${schema.name}.${table.name}`]?.map(col => (
                        <ColumnNode
                          key={col.name}
                          column={col}
                          level={3}
                          onInsert={(name) => insertText(name)}
                        />
                      ))}
                    </TreeNode>
                  ))}
                </TreeNode>
              ))}
            </TreeNode>
          ))
        )}
      </div>
    </div>
  );
}

