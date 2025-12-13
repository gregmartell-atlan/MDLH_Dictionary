import React, { useState } from 'react';
import { ChevronDown, ChevronRight, ArrowRight } from 'lucide-react';

/**
 * LineageRail - OpenLineage-compliant lineage visualization
 * 
 * Shows:
 * 1. Visual graph of upstream → target → downstream flow
 * 2. Collapsible table of raw process results
 * 
 * Design: Clean, minimal SVG diagram (DuckDB-inspired)
 * Color Palette: Monochrome + Blue + Green
 */

const COL_WIDTH = 200;
const ROW_HEIGHT = 64;
const NODE_WIDTH = 150;
const NODE_HEIGHT = 44;

// Color palette: Monochrome + Blue + Green (no orange/purple)
const TYPE_COLORS = {
  table: { bg: '#EFF6FF', border: '#3B82F6', text: '#1E40AF' },      // Blue for datasets
  view: { bg: '#F0FDF4', border: '#22C55E', text: '#166534' },       // Green for views
  process: { bg: '#F1F5F9', border: '#64748B', text: '#334155' },    // Slate for jobs
  column: { bg: '#F0F9FF', border: '#0EA5E9', text: '#0369A1' },     // Sky for columns
  unknown: { bg: '#F9FAFB', border: '#9CA3AF', text: '#374151' },    // Gray fallback
  main: { bg: '#ECFDF5', border: '#10B981', text: '#047857' },       // Emerald for focus
};

export function LineageRail({ nodes, edges, title = 'Lineage', metadata, rawProcesses }) {
  const [showRawData, setShowRawData] = useState(false);
  
  if (!nodes?.length) return null;

  const maxCol = Math.max(...nodes.map((n) => n.column));
  const maxRow = Math.max(...nodes.map((n) => n.row));

  const width = (maxCol + 1) * COL_WIDTH + 40;
  const height = (maxRow + 1) * ROW_HEIGHT + 24;

  const getPos = (id) => {
    const n = nodes.find((x) => x.id === id);
    if (!n) return { x: 0, y: 0 };
    const x = n.column * COL_WIDTH + 20;
    const y = n.row * ROW_HEIGHT + 12;
    return { x, y };
  };

  const upstreamCount = metadata?.upstreamCount || nodes.filter(n => n.column === 0).length;
  const downstreamCount = metadata?.downstreamCount || nodes.filter(n => n.column === 2).length;
  const mainNode = nodes.find(n => n.isMain);

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-700">{title}</span>
          {mainNode && (
            <span className="text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded font-mono border border-emerald-200">
              {mainNode.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-[10px] text-gray-500">
          {upstreamCount > 0 && <span className="text-blue-600">{upstreamCount} upstream</span>}
          {downstreamCount > 0 && <span className="text-green-600">{downstreamCount} downstream</span>}
        </div>
      </div>
      
      {/* Graph Visualization */}
      <div className="p-3 overflow-auto bg-white">
        <svg width={width} height={height} className="block">
          {/* Edges */}
          {edges?.map((e) => {
            const from = getPos(e.from);
            const to = getPos(e.to);
            const x1 = from.x + NODE_WIDTH;
            const y1 = from.y + NODE_HEIGHT / 2;
            const x2 = to.x;
            const y2 = to.y + NODE_HEIGHT / 2;
            
            const dx = (x2 - x1) / 2;
            const path = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
            
            return (
              <g key={`${e.from}-${e.to}`}>
                <path
                  d={path}
                  strokeWidth={1.5}
                  fill="none"
                  stroke="#CBD5E1"
                  strokeLinecap="round"
                />
                <polygon
                  points={`${x2 - 5},${y2 - 3} ${x2},${y2} ${x2 - 5},${y2 + 3}`}
                  fill="#CBD5E1"
                />
              </g>
            );
          })}

          {/* Nodes */}
          {nodes.map((n) => {
            const { x, y } = getPos(n.id);
            const colors = n.isMain ? TYPE_COLORS.main : (TYPE_COLORS[n.type] || TYPE_COLORS.unknown);
            
            return (
              <g key={n.id} transform={`translate(${x}, ${y})`} style={{ cursor: 'pointer' }}>
                {n.isMain && (
                  <rect
                    rx={8}
                    ry={8}
                    x={-2}
                    y={-2}
                    width={NODE_WIDTH + 4}
                    height={NODE_HEIGHT + 4}
                    fill="none"
                    stroke={colors.border}
                    strokeWidth={2}
                    opacity={0.3}
                  />
                )}
                <rect
                  rx={6}
                  ry={6}
                  width={NODE_WIDTH}
                  height={NODE_HEIGHT}
                  fill={colors.bg}
                  stroke={colors.border}
                  strokeWidth={n.isMain ? 2 : 1}
                />
                
                <text
                  x={10}
                  y={NODE_HEIGHT / 2 - 2}
                  fontSize={11}
                  fontWeight={500}
                  fill={colors.text}
                  fontFamily="ui-monospace, monospace"
                >
                  {n.label?.length > 18 ? n.label.slice(0, 18) + '…' : n.label || 'Unknown'}
                </text>
                
                <text
                  x={10}
                  y={NODE_HEIGHT / 2 + 11}
                  fontSize={9}
                  fill={colors.text}
                  opacity={0.6}
                  fontFamily="system-ui, sans-serif"
                  style={{ textTransform: 'uppercase' }}
                >
                  {n.typeName || n.type || 'ASSET'}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      
      {/* Raw Process Data Table (collapsible) */}
      {rawProcesses && rawProcesses.length > 0 && (
        <div className="border-t border-gray-100">
          <button
            onClick={() => setShowRawData(!showRawData)}
            className="w-full px-4 py-2 flex items-center gap-2 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
          >
            {showRawData ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span className="font-medium">Process Details</span>
            <span className="text-gray-400">({rawProcesses.length} processes)</span>
          </button>
          
          {showRawData && (
            <div className="px-4 pb-3 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 pr-4 text-gray-500 font-medium">Direction</th>
                    <th className="text-left py-2 pr-4 text-gray-500 font-medium">Process Name</th>
                    <th className="text-left py-2 pr-4 text-gray-500 font-medium">Type</th>
                    <th className="text-right py-2 text-gray-500 font-medium">In/Out</th>
                  </tr>
                </thead>
                <tbody>
                  {rawProcesses.map((proc, idx) => (
                    <tr key={proc.guid || idx} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="py-2 pr-4">
                        <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ${
                          proc.direction === 'upstream' 
                            ? 'bg-blue-50 text-blue-600' 
                            : 'bg-green-50 text-green-600'
                        }`}>
                          {proc.direction === 'upstream' ? '← Upstream' : 'Downstream →'}
                        </span>
                      </td>
                      <td className="py-2 pr-4 font-mono text-gray-800 max-w-[300px] truncate" title={proc.name}>
                        {proc.name?.includes('→') ? (
                          <span className="flex items-center gap-1">
                            <span className="text-gray-600">{proc.name.split('→')[0].trim()}</span>
                            <ArrowRight size={10} className="text-gray-400 flex-shrink-0" />
                            <span className="text-gray-800">{proc.name.split('→')[1]?.trim()}</span>
                          </span>
                        ) : (
                          proc.name
                        )}
                      </td>
                      <td className="py-2 pr-4 text-gray-500">{proc.type}</td>
                      <td className="py-2 text-right text-gray-500">
                        {proc.inputCount} / {proc.outputCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      
      {/* Legend */}
      <div className="px-4 py-2 border-t border-gray-100 flex items-center gap-4 text-[10px] text-gray-400 bg-gray-50/30">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm" style={{ background: TYPE_COLORS.table.bg, border: `1px solid ${TYPE_COLORS.table.border}` }}></span>
          <span>Table</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm" style={{ background: TYPE_COLORS.main.bg, border: `1px solid ${TYPE_COLORS.main.border}` }}></span>
          <span>Focus</span>
        </div>
        <div className="ml-auto text-gray-400">
          {nodes.length} nodes • {edges?.length || 0} edges
        </div>
      </div>
    </div>
  );
}
