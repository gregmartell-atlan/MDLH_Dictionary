/**
 * ModelingApp - Standalone Metadata Modeling Platform
 * 
 * Independent entry point for the Modeling Assistant and Model Builder.
 * Works separately from the Assessment/Evaluation functionality.
 * 
 * Features:
 * - Model Builder: Visual three-panel interface for building metadata models
 * - Modeling Assistant: Guided wizard for creating metadata models
 * - Projects: Saved modeling projects and templates
 */

import React, { useState, useEffect } from 'react';
import {
  MemoryRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from 'react-router-dom';
import {
  Sparkles,
  LayoutGrid,
  FolderOpen,
  Plus,
  ChevronRight,
  Database,
  BookOpen,
  Target,
  Layers,
  CheckCircle2,
  Clock,
  ArrowRight,
  Search,
  Settings2,
} from 'lucide-react';
import { useConnection } from '../hooks/useSnowflake';
import { AssetContextSelector, SELECTION_MODE } from '../components/common/AssetContextSelector';
import { configureMDLHBridge } from './services/mdlhBridge';
import { ModelBuilder } from '../components/evaluation/modelBuilder/ModelBuilder';
import { MetadataAssistantWizard } from '../components/evaluation/assistant/MetadataAssistantWizard';
import { FieldPresenceChecker } from '../components/evaluation/modelBuilder/FieldPresenceChecker';
import { MDLHTableAnalyzer } from '../components/evaluation/modelBuilder/MDLHTableAnalyzer';
import { PivotBuilder } from '../components/pivot/PivotBuilder';
import { useAssistantStore } from '../stores/assistantStore';

// ============================================
// MODELING HOME - Landing page with options
// ============================================

function ModelingHome({ database, schema, isConnected }) {
  const navigate = useNavigate();
  const { wizardState } = useAssistantStore();
  
  const recentProjects = wizardState.completedProjects || [];

  const tools = [
    {
      id: 'builder',
      title: 'Model Builder',
      description: 'Visual interface for building metadata models with use case templates and live MDLH coverage scanning',
      icon: LayoutGrid,
      color: 'blue',
      path: '/builder',
    },
    {
      id: 'wizard',
      title: 'Modeling Assistant',
      description: 'Step-by-step guided wizard to create metadata models based on your profile and use cases',
      icon: Sparkles,
      color: 'purple',
      path: '/wizard',
    },
    {
      id: 'presence',
      title: 'Field Presence Checker',
      description: 'Validate field mappings and coverage across multiple MDLH schemas side by side',
      icon: Search,
      color: 'indigo',
      path: '/presence',
    },
    {
      id: 'analyzer',
      title: 'Table Analyzer',
      description: 'Deep inspection of MDLH tables with column analysis, coverage stats, and signal mapping',
      icon: Layers,
      color: 'cyan',
      path: '/analyzer',
    },
    {
      id: 'pivot',
      title: 'Pivot Builder',
      description: 'Build and run pivot table queries with pre-built templates or custom configurations',
      icon: LayoutGrid,
      color: 'violet',
      path: '/pivot',
    },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Metadata Modeling</h1>
        <p className="text-gray-500 mt-2 max-w-2xl">
          Build and manage your metadata models. Define which fields matter for your use cases,
          track coverage, and create implementation plans.
        </p>
      </div>

      {/* Connection Context */}
      <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg mb-8 flex items-center gap-3">
        <Database size={18} className="text-gray-500" />
        <span className="text-sm text-gray-600">MDLH Context:</span>
        <span className="font-mono text-sm px-2 py-1 bg-white border rounded">
          {database}.{schema}
        </span>
        {isConnected ? (
          <span className="ml-auto flex items-center gap-1.5 text-sm text-emerald-600">
            <CheckCircle2 size={14} />
            Connected
          </span>
        ) : (
          <span className="ml-auto flex items-center gap-1.5 text-sm text-amber-600">
            <Clock size={14} />
            Not connected
          </span>
        )}
      </div>

      {/* Tool Cards */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {tools.map((tool) => {
          const Icon = tool.icon;
          const colorClasses = {
            blue: {
              bg: 'bg-blue-50',
              icon: 'bg-blue-100 text-blue-600',
              hover: 'hover:border-blue-300 hover:shadow-blue-100',
              button: 'bg-blue-600 hover:bg-blue-700',
            },
            purple: {
              bg: 'bg-purple-50',
              icon: 'bg-purple-100 text-purple-600',
              hover: 'hover:border-purple-300 hover:shadow-purple-100',
              button: 'bg-purple-600 hover:bg-purple-700',
            },
            indigo: {
              bg: 'bg-indigo-50',
              icon: 'bg-indigo-100 text-indigo-600',
              hover: 'hover:border-indigo-300 hover:shadow-indigo-100',
              button: 'bg-indigo-600 hover:bg-indigo-700',
            },
            cyan: {
              bg: 'bg-cyan-50',
              icon: 'bg-cyan-100 text-cyan-600',
              hover: 'hover:border-cyan-300 hover:shadow-cyan-100',
              button: 'bg-cyan-600 hover:bg-cyan-700',
            },
            violet: {
              bg: 'bg-violet-50',
              icon: 'bg-violet-100 text-violet-600',
              hover: 'hover:border-violet-300 hover:shadow-violet-100',
              button: 'bg-violet-600 hover:bg-violet-700',
            },
          };
          const colors = colorClasses[tool.color];

          return (
            <div
              key={tool.id}
              className={`bg-white border border-gray-200 rounded-xl p-6 transition-all cursor-pointer ${colors.hover} shadow-sm hover:shadow-md`}
              onClick={() => navigate(tool.path)}
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl ${colors.icon}`}>
                  <Icon size={24} />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    {tool.title}
                  </h3>
                  <p className="text-sm text-gray-500 mb-4">
                    {tool.description}
                  </p>
                  <button
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${colors.button}`}
                  >
                    Open {tool.title}
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Target size={18} className="text-slate-600" />
          Quick Start Templates
        </h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { name: 'Self-Service Discovery', icon: BookOpen, useCases: ['Data discovery', 'Self-service'] },
            { name: 'Governance & Compliance', icon: Target, useCases: ['PII tagging', 'Policies'] },
            { name: 'Data Product Catalog', icon: Layers, useCases: ['Data products', 'Contracts'] },
          ].map((template, idx) => {
            const Icon = template.icon;
            return (
              <button
                key={idx}
                onClick={() => navigate('/builder')}
                className="flex items-start gap-3 p-4 bg-white border border-slate-200 rounded-lg hover:border-slate-300 hover:shadow-sm transition-all text-left"
              >
                <div className="p-2 bg-slate-100 rounded-lg">
                  <Icon size={16} className="text-slate-600" />
                </div>
                <div>
                  <div className="font-medium text-slate-900 text-sm">{template.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {template.useCases.join(' • ')}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Recent Projects (if any) */}
      {recentProjects.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FolderOpen size={18} className="text-gray-600" />
            Recent Projects
          </h2>
          <div className="bg-white border border-gray-200 rounded-lg divide-y">
            {recentProjects.slice(0, 5).map((project, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-4 hover:bg-gray-50 cursor-pointer"
              >
                <div>
                  <div className="font-medium text-gray-900">{project.name || 'Untitled Project'}</div>
                  <div className="text-sm text-gray-500">{project.createdAt || 'Recently created'}</div>
                </div>
                <ChevronRight size={16} className="text-gray-400" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// MODEL BUILDER VIEW
// ============================================

function BuilderView({ database, schema, discoveredTables }) {
  const navigate = useNavigate();
  
  return (
    <div className="h-full flex flex-col">
      {/* Breadcrumb Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-2 text-sm">
        <button
          onClick={() => navigate('/')}
          className="text-blue-600 hover:text-blue-700 font-medium"
        >
          Modeling
        </button>
        <ChevronRight size={14} className="text-gray-400" />
        <span className="text-gray-700">Model Builder</span>
      </div>
      
      {/* Model Builder Component */}
      <div className="flex-1 overflow-auto">
        <ModelBuilder
          database={database}
          schema={schema}
          discoveredTables={discoveredTables}
        />
      </div>
    </div>
  );
}

// ============================================
// WIZARD VIEW
// ============================================

function WizardView({ database, schema }) {
  const navigate = useNavigate();
  
  const handleComplete = (project) => {
    console.log('Wizard completed with project:', project);
    navigate('/');
  };
  
  const handleClose = () => {
    navigate('/');
  };
  
  return (
    <div className="h-full">
      <MetadataAssistantWizard
        onComplete={handleComplete}
        onClose={handleClose}
      />
    </div>
  );
}

// ============================================
// FIELD PRESENCE VIEW
// ============================================

function PresenceView({ database, schema }) {
  const navigate = useNavigate();
  
  return (
    <div className="h-full flex flex-col">
      {/* Breadcrumb Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-2 text-sm">
        <button
          onClick={() => navigate('/')}
          className="text-indigo-600 hover:text-indigo-700 font-medium"
        >
          Modeling
        </button>
        <ChevronRight size={14} className="text-gray-400" />
        <span className="text-gray-700">Field Presence Checker</span>
      </div>
      
      {/* Field Presence Checker Component */}
      <div className="flex-1 overflow-auto p-6">
        <FieldPresenceChecker
          database={database}
          schema={schema}
        />
      </div>
    </div>
  );
}

// ============================================
// TABLE ANALYZER VIEW
// ============================================

function AnalyzerView({ database, schema }) {
  const navigate = useNavigate();
  
  return (
    <div className="h-full flex flex-col">
      {/* Breadcrumb Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-2 text-sm">
        <button
          onClick={() => navigate('/')}
          className="text-cyan-600 hover:text-cyan-700 font-medium"
        >
          Modeling
        </button>
        <ChevronRight size={14} className="text-gray-400" />
        <span className="text-gray-700">Table Analyzer</span>
      </div>
      
      {/* MDLH Table Analyzer Component */}
      <div className="flex-1 overflow-auto p-6">
        <MDLHTableAnalyzer
          database={database}
          schema={schema}
        />
      </div>
    </div>
  );
}

// ============================================
// PIVOT BUILDER VIEW
// ============================================

function PivotView({ database, schema }) {
  const navigate = useNavigate();
  
  return (
    <div className="h-full flex flex-col">
      {/* Breadcrumb Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-2 text-sm">
        <button
          onClick={() => navigate('/')}
          className="text-violet-600 hover:text-violet-700 font-medium"
        >
          Modeling
        </button>
        <ChevronRight size={14} className="text-gray-400" />
        <span className="text-gray-700">Pivot Builder</span>
      </div>
      
      {/* Pivot Builder Component */}
      <div className="flex-1 overflow-hidden">
        <PivotBuilder
          database={database}
          schema={schema}
        />
      </div>
    </div>
  );
}

// ============================================
// INNER ROUTES
// ============================================

function ModelingRoutes({ database, schema, isConnected, discoveredTables }) {
  return (
    <div className="modeling-app min-h-full bg-gray-50">
      <Routes>
        {/* Home */}
        <Route 
          index 
          element={
            <ModelingHome 
              database={database} 
              schema={schema}
              isConnected={isConnected}
            />
          } 
        />
        
        {/* Model Builder */}
        <Route 
          path="builder" 
          element={
            <BuilderView 
              database={database} 
              schema={schema}
              discoveredTables={discoveredTables}
            />
          } 
        />
        
        {/* Wizard */}
        <Route 
          path="wizard" 
          element={
            <WizardView 
              database={database} 
              schema={schema}
            />
          } 
        />
        
        {/* Field Presence Checker */}
        <Route 
          path="presence" 
          element={
            <PresenceView 
              database={database} 
              schema={schema}
            />
          } 
        />
        
        {/* Table Analyzer */}
        <Route 
          path="analyzer" 
          element={
            <AnalyzerView 
              database={database} 
              schema={schema}
            />
          } 
        />
        
        {/* Pivot Builder */}
        <Route 
          path="pivot" 
          element={
            <PivotView 
              database={database} 
              schema={schema}
            />
          } 
        />
        
        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function ModelingApp({ database: propDatabase, schema: propSchema, discoveredTables = new Set() }) {
  const { status: connectionStatus } = useConnection();
  const isConnected = connectionStatus?.connected === true;
  
  // Dynamic context selection
  const [selectedContext, setSelectedContext] = useState([]);
  const [showContextSelector, setShowContextSelector] = useState(false);
  
  // Use selected context or fall back to props
  const activeContext = selectedContext.length > 0 ? selectedContext[0] : null;
  const database = activeContext?.database || propDatabase;
  const schema = activeContext?.schema || propSchema;
  
  // Initialize context from props
  useEffect(() => {
    if (propDatabase && propSchema && selectedContext.length === 0) {
      setSelectedContext([{
        database: propDatabase,
        schema: propSchema,
        label: `${propDatabase}.${propSchema}`,
      }]);
    }
  }, [propDatabase, propSchema]);

  // Configure the MDLH bridge when connection changes
  useEffect(() => {
    configureMDLHBridge({
      database,
      schema,
      connected: isConnected,
    });
  }, [database, schema, isConnected]);

  return (
    <MemoryRouter>
      <div data-testid="modeling-app">
        {/* Context Selector Header */}
        <div className="px-6 pt-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Database size={18} className="text-gray-500" />
            <span className="text-sm text-gray-600">MDLH Context:</span>
            <button
              onClick={() => setShowContextSelector(!showContextSelector)}
              className={`font-mono text-sm px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-2 ${
                showContextSelector
                  ? 'bg-slate-100 border-slate-300'
                  : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span>{database}.{schema}</span>
              <Settings2 size={14} className="text-slate-400" />
            </button>
          </div>
        </div>
        
        {/* Context Selector Dropdown */}
        {showContextSelector && (
          <div className="px-6 pb-4 pt-2">
            <AssetContextSelector
              selectedSchemas={selectedContext}
              onSelectionChange={(newSelection) => {
                setSelectedContext(newSelection);
                if (newSelection.length > 0) {
                  setShowContextSelector(false);
                }
              }}
              selectionMode={SELECTION_MODE.SINGLE_SCHEMA}
              title="Select Modeling Context"
              placeholder="Choose the database and schema to model"
              defaultExpanded={true}
            />
          </div>
        )}
        
        <ModelingRoutes 
          database={database} 
          schema={schema}
          isConnected={isConnected}
          discoveredTables={discoveredTables}
        />
      </div>
    </MemoryRouter>
  );
}

export default ModelingApp;
