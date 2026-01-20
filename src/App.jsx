import React, { useState, useEffect, useRef } from 'react';
import { Download, Search, Command, Code2 } from 'lucide-react';
import { findQueryForEntity, hasQueryForEntity } from './utils/queryMatcher';
import { filterEntities, filterQueries } from './utils/filterData';
import { generateCSV, downloadCSVFile } from './utils/csvExport';
import { CellCopyButton } from './components/CopyButton';
import { QueryPanel, PlayQueryButton } from './components/QueryPanel';
import { tabs, data, columns, colHeaders } from './data/entityData';
import exampleQueries from './data/exampleQueries';

export default function App() {
  const [activeTab, setActiveTab] = useState('core');
  const [search, setSearch] = useState('');
  const [showQueries, setShowQueries] = useState(false);
  const [highlightedQuery, setHighlightedQuery] = useState(null);
  const searchRef = useRef(null);

  // Keyboard shortcut: Cmd/Ctrl + K to focus search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const filteredData = filterEntities(data[activeTab], search);
  const filteredQueriesData = filterQueries(exampleQueries[activeTab] || [], search);
  const activeTabQueries = exampleQueries[activeTab] || [];

  // Open panel with highlighted query
  const openQueryForEntity = (entityName, tableName, exampleQuery) => {
    // If entity has its own exampleQuery field (inline query from data), use that
    if (exampleQuery) {
      setHighlightedQuery(exampleQuery);
    } else {
      // Find related query from exampleQueries
      const matchedQuery = findQueryForEntity(entityName, tableName, activeTabQueries);
      setHighlightedQuery(matchedQuery?.query || null);
    }
    setShowQueries(true);
  };

  // Check if entity has a related query (wrapper using imported utility)
  const checkHasQueryForEntity = (entityName, tableName, exampleQuery) => {
    return hasQueryForEntity(entityName, tableName, exampleQuery, activeTabQueries);
  };

  const downloadCSV = () => {
    const cols = columns[activeTab];
    const csv = generateCSV(filteredData, cols, colHeaders);
    downloadCSVFile(csv, `mdlh_${activeTab}_entities.csv`);
  };

  const downloadAllCSV = () => {
    Object.keys(data).forEach(tabId => {
      const cols = columns[tabId];
      const csv = generateCSV(data[tabId], cols, colHeaders);
      downloadCSVFile(csv, `mdlh_${tabId}_entities.csv`);
    });
  };

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Navigation Bar */}
      <nav className="border-b border-gray-200 bg-white sticky top-0 z-30">
        <div className="max-w-full mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[#3366FF] font-bold text-xl">atlan</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={searchRef}
                type="text"
                placeholder="Search..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-64 pl-9 pr-16 py-2 bg-white border border-gray-300 rounded-full text-sm focus:outline-none focus:border-[#3366FF] focus:ring-2 focus:ring-[#3366FF]/20 transition-all duration-200 placeholder-gray-400"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-0.5 text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                <Command size={10} />
                <span>K</span>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="bg-[#3366FF] rounded-2xl mx-6 mt-6 p-8 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-3xl font-semibold mb-3 italic">
            Metadata Lakehouse Entity Dictionary
          </h1>
          <p className="text-blue-100 text-lg">
            Reference guide for MDLH entity types, tables, attributes, and example queries
          </p>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap justify-center gap-3 mt-6">
            <button
              onClick={() => {
                setHighlightedQuery(null);
                setShowQueries(true);
              }}
              className="px-5 py-2.5 bg-white text-[#3366FF] rounded-full text-sm font-medium hover:bg-blue-50 transition-all duration-200 flex items-center gap-2"
            >
              <Code2 size={16} />
              View All Queries
            </button>
            <button
              onClick={downloadCSV}
              className="px-5 py-2.5 bg-white/20 text-white border border-white/30 rounded-full text-sm font-medium hover:bg-white/30 transition-all duration-200 flex items-center gap-2"
            >
              <Download size={14} />
              Export Tab
            </button>
            <button
              onClick={downloadAllCSV}
              className="px-5 py-2.5 bg-white/20 text-white border border-white/30 rounded-full text-sm font-medium hover:bg-white/30 transition-all duration-200 flex items-center gap-2"
            >
              <Download size={14} />
              Export All
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-full mx-auto px-6 py-6">
        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-2 mb-6 pb-4 border-b border-gray-200">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-[#3366FF] text-white'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-[#3366FF] hover:text-[#3366FF]'
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>
        <div className="overflow-x-auto bg-white rounded-xl border border-gray-200 shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                {columns[activeTab].map(col => (
                  <th key={col} className="px-4 py-3 text-left font-semibold text-gray-700 border-b border-gray-200 text-xs uppercase tracking-wider">
                    {colHeaders[col]}
                  </th>
                ))}
                <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b border-gray-200 text-xs uppercase tracking-wider w-24">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredData.length > 0 ? (
                filteredData.map((row, i) => (
                  <tr key={i} className="group hover:bg-blue-50/50 transition-colors duration-150">
                    {columns[activeTab].map(col => (
                      <td key={col} className="px-4 py-3 align-top">
                        {col === 'entity' ? (
                          <span className="inline-flex items-center">
                            <span className="font-semibold text-[#3366FF]">{row[col]}</span>
                            <CellCopyButton text={row[col]} />
                          </span>
                        ) : col === 'table' ? (
                          <span className="inline-flex items-center">
                            <span className="font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded text-xs">{row[col]}</span>
                            {row[col] !== '(abstract)' && <CellCopyButton text={row[col]} />}
                          </span>
                        ) : col === 'exampleQuery' ? (
                          <span className="inline-flex items-center">
                            <code className="text-gray-600 bg-gray-100 px-2 py-0.5 rounded text-xs break-all">{row[col]}</code>
                            {row[col] && <CellCopyButton text={row[col]} />}
                          </span>
                        ) : (
                          <span className="text-gray-600">{row[col]}</span>
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-3 align-top">
                      <PlayQueryButton
                        hasQuery={checkHasQueryForEntity(row.entity, row.table, row.exampleQuery)}
                        onClick={() => openQueryForEntity(row.entity, row.table, row.exampleQuery)}
                      />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns[activeTab].length + 1} className="px-4 py-12 text-center">
                    <Search size={32} className="mx-auto text-gray-300 mb-2" />
                    <p className="text-gray-600 font-medium">No results found</p>
                    <p className="text-gray-400 text-xs mt-1">Try adjusting your search terms</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing <span className="text-gray-900 font-medium">{filteredData.length}</span> of <span className="text-gray-900 font-medium">{data[activeTab].length}</span> entities in <span className="text-[#3366FF] font-medium">{tabs.find(t => t.id === activeTab)?.label}</span>
          </p>
          <p className="text-sm text-gray-400">
            Press <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded text-gray-600 font-mono text-xs">&#8984;K</kbd> to search &bull; Click <span className="text-[#3366FF]">Query</span> buttons for SQL examples
          </p>
        </div>
      </div>

      {/* Query Side Panel */}
      <QueryPanel
        isOpen={showQueries}
        onClose={() => {
          setShowQueries(false);
          setHighlightedQuery(null);
        }}
        queries={filteredQueriesData}
        categoryLabel={tabs.find(t => t.id === activeTab)?.label}
        highlightedQuery={highlightedQuery}
      />
    </div>
  );
}
