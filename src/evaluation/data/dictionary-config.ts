/**
 * Entity Dictionary Configuration
 *
 * Defines categories, column configurations, and display settings
 * for the MDLH Entity Dictionary reference guide.
 */

import type { LucideIcon } from 'lucide-react';
import {
  Table,
  Database,
  BookOpen,
  Boxes,
  FolderTree,
  BarChart3,
  GitBranch,
  Cloud,
  Workflow,
  Shield,
  Bot,
} from 'lucide-react';

// Category/Tab definition
export interface DictionaryTab {
  id: string;
  label: string;
  icon: LucideIcon;
}

// Entity data row type
export interface EntityRow {
  entity: string;
  table: string;
  description: string;
  keyAttributes: string;
  relationships: string;
  notes?: string;
  qualifiedNamePattern?: string;
  exampleQuery?: string;
  hierarchy?: string;
  connector?: string;
}

// Query definition
export interface ExampleQuery {
  title: string;
  description: string;
  query: string;
}

// Column configuration per tab
export type ColumnKey = 'entity' | 'table' | 'description' | 'keyAttributes' | 'relationships' | 'qualifiedNamePattern' | 'hierarchy' | 'connector' | 'notes' | 'exampleQuery';

// All tabs/categories
export const DICTIONARY_TABS: DictionaryTab[] = [
  { id: 'core', label: 'Core', icon: Table },
  { id: 'glossary', label: 'Glossary', icon: BookOpen },
  { id: 'datamesh', label: 'Data Mesh', icon: Boxes },
  { id: 'relational', label: 'Relational DB', icon: Database },
  { id: 'queries', label: 'Query Org', icon: FolderTree },
  { id: 'bi', label: 'BI Tools', icon: BarChart3 },
  { id: 'dbt', label: 'dbt', icon: GitBranch },
  { id: 'storage', label: 'Object Storage', icon: Cloud },
  { id: 'orchestration', label: 'Orchestration', icon: Workflow },
  { id: 'governance', label: 'Governance', icon: Shield },
  { id: 'ai', label: 'AI/ML', icon: Bot },
];

// Columns to display per tab
export const TAB_COLUMNS: Record<string, ColumnKey[]> = {
  core: ['entity', 'table', 'description', 'keyAttributes', 'relationships', 'notes'],
  glossary: ['entity', 'table', 'description', 'keyAttributes', 'relationships', 'qualifiedNamePattern', 'exampleQuery'],
  datamesh: ['entity', 'table', 'description', 'keyAttributes', 'relationships', 'qualifiedNamePattern', 'exampleQuery'],
  relational: ['entity', 'table', 'description', 'keyAttributes', 'relationships', 'qualifiedNamePattern', 'hierarchy'],
  queries: ['entity', 'table', 'description', 'keyAttributes', 'relationships', 'hierarchy', 'notes'],
  bi: ['entity', 'table', 'description', 'keyAttributes', 'relationships', 'connector', 'hierarchy'],
  dbt: ['entity', 'table', 'description', 'keyAttributes', 'relationships', 'qualifiedNamePattern', 'notes'],
  storage: ['entity', 'table', 'description', 'keyAttributes', 'relationships', 'connector', 'hierarchy'],
  orchestration: ['entity', 'table', 'description', 'keyAttributes', 'relationships', 'connector', 'hierarchy'],
  governance: ['entity', 'table', 'description', 'keyAttributes', 'relationships', 'notes'],
  ai: ['entity', 'table', 'description', 'keyAttributes', 'relationships', 'notes'],
};

// Column display headers
export const COLUMN_HEADERS: Record<ColumnKey, string> = {
  entity: 'Entity Type',
  table: 'MDLH Table',
  description: 'Description',
  keyAttributes: 'Key Attributes',
  relationships: 'Relationships',
  qualifiedNamePattern: 'qualifiedName Pattern',
  hierarchy: 'Hierarchy',
  connector: 'Connector',
  notes: 'Notes',
  exampleQuery: 'Example Query',
};
