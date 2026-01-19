/**
 * ERDDiagram - Entity Relationship Diagram visualization
 * Shows relationships between MDLH entity tables
 */

import React, { useMemo } from 'react';
import { useTenantConfigStore } from '../../stores/tenantConfigStore';
import { Network, Database, Table, ArrowRight } from 'lucide-react';

interface TableNode {
  id: string;
  name: string;
  type: string;
  rowCount?: number;
  x: number;
  y: number;
}

interface Relationship {
  from: string;
  to: string;
  type: string;
}

export function ERDDiagram() {
  const { schemaSnapshot } = useTenantConfigStore();

  const tables = (schemaSnapshot as any)?.tables || [];
  const columns = (schemaSnapshot as any)?.columns || {};

  // Build relationships based on common patterns in MDLH
  const relationships = useMemo(() => {
    const rels: Relationship[] = [];
    const tableNames = tables.map(t => t.name || '').filter(Boolean);

    // Common MDLH relationship patterns
    const patterns = [
      { from: 'CONNECTION_ENTITY', to: 'DATABASE_ENTITY', type: 'contains' },
      { from: 'DATABASE_ENTITY', to: 'SCHEMA_ENTITY', type: 'contains' },
      { from: 'SCHEMA_ENTITY', to: 'TABLE_ENTITY', type: 'contains' },
      { from: 'SCHEMA_ENTITY', to: 'VIEW_ENTITY', type: 'contains' },
      { from: 'TABLE_ENTITY', to: 'COLUMN_ENTITY', type: 'contains' },
      { from: 'VIEW_ENTITY', to: 'COLUMN_ENTITY', type: 'contains' },
      { from: 'PROCESS_ENTITY', to: 'TABLE_ENTITY', type: 'lineage' },
      { from: 'TABLE_ENTITY', to: 'PROCESS_ENTITY', type: 'lineage' },
      { from: 'ATLASGLOSSARY_ENTITY', to: 'ATLASGLOSSARYTERM_ENTITY', type: 'contains' },
      { from: 'ATLASGLOSSARYTERM_ENTITY', to: 'TABLE_ENTITY', type: 'governance' },
    ];

    // Filter to only include relationships where both tables exist
    patterns.forEach(pattern => {
      if (tableNames.includes(pattern.from) && tableNames.includes(pattern.to)) {
        rels.push(pattern);
      }
    });

    return rels;
  }, [tables]);

  // Calculate node positions (simple grid layout)
  const nodes = useMemo(() => {
    const entityTables = tables.filter(t => 
      t.name && t.name.endsWith('_ENTITY')
    );
    
    // Group by category
    const core = entityTables.filter(t => 
      ['CONNECTION', 'DATABASE', 'SCHEMA', 'TABLE', 'VIEW', 'COLUMN', 'PROCESS'].some(
        prefix => t.name?.startsWith(prefix)
      )
    );
    const glossary = entityTables.filter(t => 
      t.name?.startsWith('ATLASGLOSSARY')
    );
    const other = entityTables.filter(t => 
      !core.includes(t) && !glossary.includes(t)
    );

    const allGroups = [core, glossary, other];
    const nodes: TableNode[] = [];
    let yOffset = 0;

    allGroups.forEach((group, groupIdx) => {
      if (group.length === 0) return;
      
      const cols = Math.ceil(Math.sqrt(group.length));
      group.forEach((table, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        
        nodes.push({
          id: table.name || '',
          name: table.name || '',
          type: table.type || 'BASE TABLE',
          rowCount: table.rowCount,
          x: col * 200 + 100,
          y: yOffset + row * 120 + 60,
        });
      });
      
      yOffset += Math.ceil(group.length / cols) * 120 + 80;
    });

    return nodes;
  }, [tables]);

  if (tables.length === 0) {
    return (
      <div className="p-6 text-center text-gray-500">
        <Network size={48} className="mx-auto mb-3 text-gray-300" />
        <p className="text-sm">No schema data available for ERD</p>
      </div>
    );
  }

  const width = Math.max(800, Math.max(...nodes.map(n => n.x)) + 200);
  const height = Math.max(600, Math.max(...nodes.map(n => n.y)) + 100);

  return (
    <div className="relative overflow-auto bg-gray-50 border border-gray-200 rounded-lg" style={{ minHeight: '400px' }}>
      <svg width={width} height={height} className="absolute inset-0">
        {/* Draw relationships */}
        {relationships.map((rel, idx) => {
          const fromNode = nodes.find(n => n.id === rel.from);
          const toNode = nodes.find(n => n.id === rel.to);
          
          if (!fromNode || !toNode) return null;

          const strokeColor = 
            rel.type === 'lineage' ? '#3b82f6' :
            rel.type === 'governance' ? '#8b5cf6' :
            '#10b981';

          return (
            <line
              key={idx}
              x1={fromNode.x}
              y1={fromNode.y}
              x2={toNode.x}
              y2={toNode.y}
              stroke={strokeColor}
              strokeWidth={2}
              strokeDasharray={rel.type === 'lineage' ? '5,5' : 'none'}
              opacity={0.6}
              markerEnd="url(#arrowhead)"
            />
          );
        })}

        {/* Arrow marker */}
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 10 3, 0 6" fill="#6b7280" />
          </marker>
        </defs>

        {/* Draw nodes */}
        {nodes.map((node) => (
          <g key={node.id}>
            {/* Node rectangle */}
            <rect
              x={node.x - 80}
              y={node.y - 30}
              width={160}
              height={60}
              rx={8}
              fill="white"
              stroke="#3b82f6"
              strokeWidth={2}
              className="hover:stroke-blue-600 hover:shadow-lg transition-all cursor-pointer"
            />
            
            {/* Table icon */}
            <foreignObject x={node.x - 70} y={node.y - 20} width={20} height={20}>
              <Table size={16} className="text-blue-600" />
            </foreignObject>
            
            {/* Table name */}
            <text
              x={node.x - 45}
              y={node.y - 5}
              fontSize="12"
              fontWeight="semibold"
              fill="#1f2937"
              className="font-mono"
            >
              {node.name.replace('_ENTITY', '')}
            </text>
            
            {/* Row count */}
            {node.rowCount !== undefined && (
              <text
                x={node.x}
                y={node.y + 15}
                fontSize="10"
                fill="#6b7280"
                textAnchor="middle"
              >
                {node.rowCount.toLocaleString()} rows
              </text>
            )}
          </g>
        ))}
      </svg>

      {/* Legend */}
      <div className="absolute top-4 right-4 bg-white border border-gray-200 rounded-lg p-3 shadow-lg z-10">
        <h4 className="text-xs font-semibold text-gray-700 mb-2">Relationship Types</h4>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-green-500"></div>
            <span className="text-gray-600">Contains</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-blue-500 border-dashed border-t-2 border-blue-500"></div>
            <span className="text-gray-600">Lineage</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-purple-500"></div>
            <span className="text-gray-600">Governance</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="absolute bottom-4 left-4 bg-white border border-gray-200 rounded-lg p-3 shadow-lg z-10">
        <div className="text-xs space-y-1">
          <div className="flex items-center gap-2">
            <Database size={14} className="text-blue-600" />
            <span className="text-gray-700 font-medium">{nodes.length} entities</span>
          </div>
          <div className="flex items-center gap-2">
            <ArrowRight size={14} className="text-gray-500" />
            <span className="text-gray-600">{relationships.length} relationships</span>
          </div>
        </div>
      </div>
    </div>
  );
}
