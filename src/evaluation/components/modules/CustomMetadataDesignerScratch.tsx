/**
 * CustomMetadataDesignerScratch - Visual custom metadata schema builder
 *
 * Features:
 * - Template selection (data product, compliance, data quality, operational, business context)
 * - Enhanced sidebar with animated selection states
 * - Slide-in flyout panels (not centered modals)
 * - Schema editor with attribute configuration
 * - Live preview panel
 */

import { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  Eye,
  Database,
  FileText,
  Shield,
  AlertCircle,
  Briefcase,
  Settings,
  ChevronRight,
  Table,
  Columns,
  LayoutDashboard,
  Copy,
  Sparkles,
  Check,
  Info,
} from 'lucide-react';
import {
  CUSTOM_METADATA_TEMPLATES,
  createCustomMetadataFromTemplate,
  validateAttributeName,
} from '../../types/custom-metadata';
import type {
  CustomMetadataDesign,
  CustomAttribute,
  AttributeType,
  CustomMetadataTemplate,
} from '../../types/custom-metadata';
import type { AssetType } from '../../types/requirements';
import { createId } from '../../utils/id';

// ============================================
// CONSTANTS & CONFIGURATION
// ============================================

const TEMPLATE_ICONS: Record<string, typeof Database> = {
  'data-product': Database,
  'compliance': Shield,
  'data-quality': AlertCircle,
  'operational': Settings,
  'business-context': Briefcase,
};

const TEMPLATE_COLORS: Record<string, { bg: string; text: string; accent: string }> = {
  'data-product': { bg: 'bg-blue-50', text: 'text-blue-700', accent: 'border-blue-400' },
  'compliance': { bg: 'bg-purple-50', text: 'text-purple-700', accent: 'border-purple-400' },
  'data-quality': { bg: 'bg-amber-50', text: 'text-amber-700', accent: 'border-amber-400' },
  'operational': { bg: 'bg-slate-100', text: 'text-slate-700', accent: 'border-slate-400' },
  'business-context': { bg: 'bg-emerald-50', text: 'text-emerald-700', accent: 'border-emerald-400' },
  'custom': { bg: 'bg-slate-50', text: 'text-slate-600', accent: 'border-slate-300' },
};

const ASSET_TYPES: AssetType[] = [
  'Table',
  'View',
  'Column',
  'Database',
  'Schema',
  'Dashboard',
  'Dataset',
  'Report',
  'Pipeline',
];

const ASSET_TYPE_ICONS: Record<string, typeof Table> = {
  Table: Table,
  View: Table,
  Column: Columns,
  Dashboard: LayoutDashboard,
  Dataset: Database,
  Report: FileText,
  Pipeline: Settings,
  Database: Database,
  Schema: Database,
};

const ATTRIBUTE_TYPES: { value: AttributeType; label: string; description: string; icon: string }[] = [
  { value: 'string', label: 'Text', description: 'Single or multi-line text', icon: 'Aa' },
  { value: 'number', label: 'Number', description: 'Numeric value', icon: '#' },
  { value: 'boolean', label: 'Boolean', description: 'True/false toggle', icon: '✓' },
  { value: 'date', label: 'Date', description: 'Date picker', icon: '📅' },
  { value: 'datetime', label: 'Date & Time', description: 'Date and time picker', icon: '🕐' },
  { value: 'enum', label: 'Dropdown', description: 'Single selection from list', icon: '▼' },
  { value: 'multiSelect', label: 'Multi-select', description: 'Multiple selections', icon: '☑' },
  { value: 'user', label: 'User', description: 'Atlan user picker', icon: '👤' },
  { value: 'group', label: 'Group', description: 'Atlan group picker', icon: '👥' },
  { value: 'url', label: 'URL', description: 'Link/URL field', icon: '🔗' },
  { value: 'sql', label: 'SQL', description: 'SQL query editor', icon: '{ }' },
];

// ============================================
// MAIN COMPONENT
// ============================================

interface CustomMetadataDesignerScratchProps {
  initialSchemas?: CustomMetadataDesign[];
  onSave?: (schemas: CustomMetadataDesign[]) => void;
}

export function CustomMetadataDesignerScratch({ initialSchemas, onSave }: CustomMetadataDesignerScratchProps) {
  const [step, setStep] = useState<'template' | 'design'>(initialSchemas && initialSchemas.length > 0 ? 'design' : 'template');
  const [schemas, setSchemas] = useState<CustomMetadataDesign[]>(initialSchemas || []);
  const [selectedSchemaId, setSelectedSchemaId] = useState<string | null>(initialSchemas && initialSchemas.length > 0 ? initialSchemas[0].id : null);
  const [editingAttribute, setEditingAttribute] = useState<CustomAttribute | null>(null);
  const [showAttributeFlyout, setShowAttributeFlyout] = useState(false);
  const [showPreviewFlyout, setShowPreviewFlyout] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [hoveredSchemaId, setHoveredSchemaId] = useState<string | null>(null);

  const selectedSchema = schemas.find((s) => s.id === selectedSchemaId);

  // Determine template type for color coding
  const getSchemaTemplateType = (schema: CustomMetadataDesign): string => {
    const templateMatch = CUSTOM_METADATA_TEMPLATES.find(t =>
      t.schema.displayName === schema.displayName ||
      schema.id.includes(t.id)
    );
    return templateMatch?.id || 'custom';
  };

  // Handle template selection
  const handleSelectTemplate = (template: CustomMetadataTemplate) => {
    const newSchema = createCustomMetadataFromTemplate(template, createId('schema'));
    setSchemas((prev) => [...prev, newSchema]);
    setSelectedSchemaId(newSchema.id);
    setStep('design');
  };

  // Add blank schema
  const addBlankSchema = () => {
    const newSchema: CustomMetadataDesign = {
      id: createId('schema'),
      name: 'CustomMetadata',
      displayName: 'New Custom Metadata',
      description: '',
      appliesTo: [],
      attributes: [],
      isRequired: false,
      domains: [],
    };
    setSchemas((prev) => [...prev, newSchema]);
    setSelectedSchemaId(newSchema.id);
    setStep('design');
  };

  // Update schema
  const updateSchema = (id: string, updates: Partial<CustomMetadataDesign>) => {
    setSchemas(schemas.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  // Delete schema
  const deleteSchema = (id: string) => {
    setSchemas(schemas.filter((s) => s.id !== id));
    if (selectedSchemaId === id) {
      setSelectedSchemaId(schemas.length > 1 ? schemas.find(s => s.id !== id)?.id || null : null);
    }
  };

  // Duplicate schema
  const duplicateSchema = (schema: CustomMetadataDesign) => {
    const newSchema: CustomMetadataDesign = {
      ...schema,
      id: createId('schema'),
      name: `${schema.name}_copy`,
      displayName: `${schema.displayName} (Copy)`,
      attributes: schema.attributes.map((attr) => ({
        ...attr,
        id: createId('attr'),
      })),
    };
    setSchemas((prev) => [...prev, newSchema]);
    setSelectedSchemaId(newSchema.id);
  };

  // Add or update attribute
  const saveAttribute = (attribute: CustomAttribute) => {
    if (!selectedSchema) return;

    const existingIndex = selectedSchema.attributes.findIndex((a) => a.id === attribute.id);
    let updatedAttributes: CustomAttribute[];

    if (existingIndex >= 0) {
      updatedAttributes = selectedSchema.attributes.map((a) =>
        a.id === attribute.id ? attribute : a
      );
    } else {
      updatedAttributes = [...selectedSchema.attributes, attribute];
    }

    updateSchema(selectedSchema.id, { attributes: updatedAttributes });
    setShowAttributeFlyout(false);
    setEditingAttribute(null);
  };

  // Delete attribute
  const deleteAttribute = (attributeId: string) => {
    if (!selectedSchema) return;
    updateSchema(selectedSchema.id, {
      attributes: selectedSchema.attributes.filter((a) => a.id !== attributeId),
    });
  };

  // Move attribute
  const moveAttribute = (attributeId: string, direction: 'up' | 'down') => {
    if (!selectedSchema) return;
    const index = selectedSchema.attributes.findIndex((a) => a.id === attributeId);
    if (index === -1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= selectedSchema.attributes.length) return;

    const newAttributes = [...selectedSchema.attributes];
    [newAttributes[index], newAttributes[newIndex]] = [newAttributes[newIndex], newAttributes[index]];

    newAttributes.forEach((attr, idx) => {
      attr.order = idx;
    });

    updateSchema(selectedSchema.id, { attributes: newAttributes });
  };

  // Open attribute flyout for editing
  const openAttributeFlyout = (attribute?: CustomAttribute) => {
    if (attribute) {
      setEditingAttribute(attribute);
    } else {
      setEditingAttribute({
        id: createId('attr'),
        name: '',
        displayName: '',
        description: '',
        type: 'string',
        isRequired: false,
        isMultiValued: false,
        order: selectedSchema?.attributes.length || 0,
      });
    }
    setShowAttributeFlyout(true);
  };

  // ============================================
  // TEMPLATE SELECTION SCREEN
  // ============================================

  if (step === 'template' && schemas.length === 0) {
    return (
      <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 to-slate-100">
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-200/80 bg-white/50 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Sparkles size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Custom Metadata Designer</h2>
              <p className="text-sm text-slate-500">
                Choose a template to get started quickly
              </p>
            </div>
          </div>
        </div>

        {/* Templates Grid */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {CUSTOM_METADATA_TEMPLATES.map((template, index) => {
                const Icon = TEMPLATE_ICONS[template.id] || Database;
                const colors = TEMPLATE_COLORS[template.id] || TEMPLATE_COLORS.custom;
                return (
                  <button
                    key={template.id}
                    onClick={() => handleSelectTemplate(template)}
                    className="group relative p-6 rounded-2xl bg-white border-2 border-slate-200 hover:border-blue-400 hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300 text-left overflow-hidden"
                    style={{
                      animationDelay: `${index * 50}ms`,
                    }}
                  >
                    {/* Decorative gradient */}
                    <div className={`absolute top-0 left-0 right-0 h-1 ${colors.bg} opacity-0 group-hover:opacity-100 transition-opacity`} />

                    <div className={`w-12 h-12 rounded-xl ${colors.bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                      <Icon size={24} className={colors.text} />
                    </div>

                    <h3 className="font-semibold text-slate-900 mb-2 group-hover:text-blue-700 transition-colors">
                      {template.name}
                    </h3>
                    <p className="text-sm text-slate-500 mb-4 line-clamp-2">
                      {template.description}
                    </p>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">
                        {template.useCase}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full ${colors.bg} ${colors.text}`}>
                        {template.schema.attributes?.length || 0} fields
                      </span>
                    </div>

                    {/* Hover arrow */}
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 -translate-x-2 transition-all">
                      <ChevronRight size={20} className="text-blue-500" />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Start from scratch */}
            <button
              onClick={addBlankSchema}
              className="w-full mt-6 p-5 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/50 transition-all duration-300 flex items-center justify-center gap-3"
            >
              <Plus size={20} />
              <span className="font-medium">Start from scratch</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // DESIGN SCREEN
  // ============================================

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md shadow-blue-500/20">
            <Database size={18} className="text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Custom Metadata Designer</h2>
            <p className="text-xs text-slate-500">{schemas.length} schema{schemas.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setStep('template')}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <Plus size={16} />
            Add from Template
          </button>
          <button
            onClick={addBlankSchema}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <Plus size={16} />
            Blank Schema
          </button>
          {onSave && (
            <button
              onClick={() => onSave(schemas)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-all"
            >
              <Save size={16} />
              Save All
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Enhanced Sidebar */}
        <div
          className={`${sidebarCollapsed ? 'w-16' : 'w-72'} border-r border-slate-200 bg-white flex flex-col transition-all duration-300`}
        >
          {/* Sidebar Header */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            {!sidebarCollapsed && (
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Schemas</span>
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ChevronRight
                size={16}
                className={`text-slate-400 transition-transform duration-300 ${sidebarCollapsed ? '' : 'rotate-180'}`}
              />
            </button>
          </div>

          {/* Schema List */}
          <div className="flex-1 overflow-y-auto py-2">
            {schemas.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm px-4">
                {sidebarCollapsed ? (
                  <Plus size={20} className="mx-auto opacity-50" />
                ) : (
                  'No schemas yet'
                )}
              </div>
            ) : (
              <div className="space-y-1 px-2">
                {schemas.map((schema) => {
                  const templateType = getSchemaTemplateType(schema);
                  const colors = TEMPLATE_COLORS[templateType] || TEMPLATE_COLORS.custom;
                  const isSelected = selectedSchemaId === schema.id;
                  const isHovered = hoveredSchemaId === schema.id;

                  return (
                    <div
                      key={schema.id}
                      className="relative"
                      onMouseEnter={() => setHoveredSchemaId(schema.id)}
                      onMouseLeave={() => setHoveredSchemaId(null)}
                    >
                      {/* Selection indicator */}
                      <div
                        className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 rounded-r-full transition-all duration-300 ${
                          isSelected
                            ? 'h-8 bg-blue-600'
                            : 'h-0 bg-transparent'
                        }`}
                      />

                      <button
                        onClick={() => setSelectedSchemaId(schema.id)}
                        className={`w-full text-left rounded-xl transition-all duration-200 ${
                          sidebarCollapsed ? 'p-2' : 'px-3 py-2.5 pl-4'
                        } ${
                          isSelected
                            ? 'bg-blue-50 shadow-sm'
                            : isHovered
                            ? 'bg-slate-50'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        {sidebarCollapsed ? (
                          /* Collapsed view - icon only */
                          <div className={`w-8 h-8 rounded-lg ${colors.bg} flex items-center justify-center`}>
                            <Database size={16} className={colors.text} />
                          </div>
                        ) : (
                          /* Expanded view */
                          <div className="flex items-start gap-3">
                            <div className={`w-8 h-8 rounded-lg ${colors.bg} flex items-center justify-center flex-shrink-0`}>
                              <Database size={14} className={colors.text} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className={`text-sm font-medium truncate transition-colors ${
                                isSelected ? 'text-blue-700' : 'text-slate-800'
                              }`}>
                                {schema.displayName}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-slate-400">
                                  {schema.attributes.length} field{schema.attributes.length !== 1 ? 's' : ''}
                                </span>
                                {schema.appliesTo.length > 0 && (
                                  <>
                                    <span className="text-slate-300">·</span>
                                    <span className="text-xs text-slate-400">
                                      {schema.appliesTo.length} type{schema.appliesTo.length !== 1 ? 's' : ''}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </button>

                      {/* Hover actions */}
                      {isHovered && !sidebarCollapsed && (
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 bg-white rounded-lg shadow-sm border border-slate-200 p-0.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              duplicateSchema(schema);
                            }}
                            className="p-1.5 hover:bg-slate-100 rounded-md transition-colors"
                            title="Duplicate"
                          >
                            <Copy size={12} className="text-slate-500" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteSchema(schema.id);
                            }}
                            className="p-1.5 hover:bg-red-50 rounded-md transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={12} className="text-red-500" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Schema Editor */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
          {selectedSchema ? (
            <SchemaEditor
              schema={selectedSchema}
              onUpdate={(updates) => updateSchema(selectedSchema.id, updates)}
              onDelete={() => deleteSchema(selectedSchema.id)}
              onAddAttribute={() => openAttributeFlyout()}
              onEditAttribute={openAttributeFlyout}
              onDeleteAttribute={deleteAttribute}
              onMoveAttribute={moveAttribute}
              onPreview={() => setShowPreviewFlyout(true)}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <Database size={32} className="text-slate-300" />
                </div>
                <p className="text-slate-500 font-medium">Select a schema to edit</p>
                <p className="text-sm text-slate-400 mt-1">or create a new one</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Attribute Flyout Panel */}
      <FlyoutPanel
        isOpen={showAttributeFlyout}
        onClose={() => {
          setShowAttributeFlyout(false);
          setEditingAttribute(null);
        }}
        title={editingAttribute?.name ? 'Edit Attribute' : 'New Attribute'}
      >
        {editingAttribute && (
          <AttributeEditor
            attribute={editingAttribute}
            onSave={saveAttribute}
            onCancel={() => {
              setShowAttributeFlyout(false);
              setEditingAttribute(null);
            }}
          />
        )}
      </FlyoutPanel>

      {/* Preview Flyout Panel */}
      <FlyoutPanel
        isOpen={showPreviewFlyout}
        onClose={() => setShowPreviewFlyout(false)}
        title="Preview"
        width="wide"
      >
        {selectedSchema && <SchemaPreview schema={selectedSchema} />}
      </FlyoutPanel>
    </div>
  );
}

// ============================================
// FLYOUT PANEL COMPONENT
// ============================================

interface FlyoutPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  width?: 'normal' | 'wide';
  children: React.ReactNode;
}

function FlyoutPanel({ isOpen, onClose, title, width = 'normal', children }: FlyoutPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm animate-flyoutFadeIn"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={`absolute top-0 right-0 h-full bg-white shadow-2xl flex flex-col animate-flyoutSlideIn ${
          width === 'wide' ? 'w-[600px]' : 'w-[480px]'
        }`}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <X size={18} className="text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}

// ============================================
// SCHEMA EDITOR COMPONENT
// ============================================

interface SchemaEditorProps {
  schema: CustomMetadataDesign;
  onUpdate: (updates: Partial<CustomMetadataDesign>) => void;
  onDelete: () => void;
  onAddAttribute: () => void;
  onEditAttribute: (attr: CustomAttribute) => void;
  onDeleteAttribute: (id: string) => void;
  onMoveAttribute: (id: string, direction: 'up' | 'down') => void;
  onPreview: () => void;
}

function SchemaEditor({
  schema,
  onUpdate,
  onDelete,
  onAddAttribute,
  onEditAttribute,
  onDeleteAttribute,
  onMoveAttribute,
  onPreview,
}: SchemaEditorProps) {
  const [activeSection, setActiveSection] = useState<'info' | 'types' | 'attributes'>('attributes');

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Section Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit">
          {[
            { id: 'info', label: 'Basic Info' },
            { id: 'types', label: 'Asset Types' },
            { id: 'attributes', label: 'Attributes' },
          ].map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id as typeof activeSection)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeSection === section.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {section.label}
            </button>
          ))}
        </div>

        {/* Basic Info Section */}
        {activeSection === 'info' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
            <div className="grid grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  API Name
                </label>
                <input
                  type="text"
                  value={schema.name}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^a-zA-Z0-9_]/g, '');
                    onUpdate({ name: value });
                  }}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm transition-shadow"
                  placeholder="CustomMetadata"
                />
                <p className="text-xs text-slate-500 mt-1.5">
                  Used in API calls (alphanumeric and underscores only)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Display Name
                </label>
                <input
                  type="text"
                  value={schema.displayName}
                  onChange={(e) => onUpdate({ displayName: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                  placeholder="Custom Metadata"
                />
                <p className="text-xs text-slate-500 mt-1.5">
                  Human-readable name shown in UI
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Description
              </label>
              <textarea
                value={schema.description}
                onChange={(e) => onUpdate({ description: e.target.value })}
                rows={3}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow resize-none"
                placeholder="Describe the purpose of this custom metadata..."
              />
            </div>
          </div>
        )}

        {/* Asset Types Section */}
        {activeSection === 'types' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <p className="text-sm text-slate-600 mb-4">
              Select which asset types this custom metadata can be applied to.
            </p>
            <div className="grid grid-cols-3 gap-3">
              {ASSET_TYPES.map((assetType) => {
                const Icon = ASSET_TYPE_ICONS[assetType] || Database;
                const isSelected = schema.appliesTo.includes(assetType);
                return (
                  <button
                    key={assetType}
                    onClick={() => {
                      const newAppliesTo = isSelected
                        ? schema.appliesTo.filter((t) => t !== assetType)
                        : [...schema.appliesTo, assetType];
                      onUpdate({ appliesTo: newAppliesTo });
                    }}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-sm transition-all duration-200 ${
                      isSelected
                        ? 'bg-blue-50 border-blue-400 text-blue-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <Icon size={18} />
                    <span className="font-medium">{assetType}</span>
                    {isSelected && (
                      <Check size={16} className="ml-auto text-blue-600" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Attributes Section */}
        {activeSection === 'attributes' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Attributes</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {schema.attributes.length} field{schema.attributes.length !== 1 ? 's' : ''} defined
                </p>
              </div>
              <button
                onClick={onAddAttribute}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-all"
              >
                <Plus size={16} />
                Add Attribute
              </button>
            </div>

            {schema.attributes.length === 0 ? (
              <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center">
                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <Plus size={24} className="text-slate-400" />
                </div>
                <p className="text-slate-600 font-medium">No attributes yet</p>
                <p className="text-sm text-slate-400 mt-1">
                  Add attributes to define the fields in this custom metadata
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {schema.attributes
                  .sort((a, b) => a.order - b.order)
                  .map((attr, index) => (
                    <AttributeCard
                      key={attr.id}
                      attribute={attr}
                      index={index}
                      total={schema.attributes.length}
                      onEdit={() => onEditAttribute(attr)}
                      onDelete={() => onDeleteAttribute(attr.id)}
                      onMoveUp={() => onMoveAttribute(attr.id, 'up')}
                      onMoveDown={() => onMoveAttribute(attr.id, 'down')}
                    />
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
          <button
            onClick={onDelete}
            className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-xl transition-colors"
          >
            <Trash2 size={16} />
            Delete Schema
          </button>

          <button
            onClick={onPreview}
            className="flex items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
          >
            <Eye size={16} />
            Preview
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// ATTRIBUTE CARD COMPONENT
// ============================================

interface AttributeCardProps {
  attribute: CustomAttribute;
  index: number;
  total: number;
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  }

function AttributeCard({ attribute, index, total, onEdit, onDelete, onMoveUp, onMoveDown }: AttributeCardProps) {
  const typeInfo = ATTRIBUTE_TYPES.find((t) => t.value === attribute.type);
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className={`group bg-white rounded-xl border border-slate-200 p-4 transition-all duration-200 ${
        isHovered ? 'border-slate-300 shadow-md' : 'hover:border-slate-300'
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-start gap-4">
        {/* Drag handle */}
        <div className="flex flex-col gap-0.5 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onMoveUp}
            disabled={index === 0}
            className="p-1 hover:bg-slate-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight size={14} className="transform -rotate-90 text-slate-400" />
          </button>
          <button
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="p-1 hover:bg-slate-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight size={14} className="transform rotate-90 text-slate-400" />
          </button>
        </div>

        {/* Type indicator */}
        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0 text-lg">
          {typeInfo?.icon || '?'}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-900">
              {attribute.displayName}
            </span>
            {attribute.isRequired && (
              <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-xs rounded font-medium">
                Required
              </span>
            )}
            {attribute.isMultiValued && (
              <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs rounded font-medium">
                Multi
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <code className="text-xs text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
              {attribute.name}
            </code>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs text-slate-500">
              {typeInfo?.label || attribute.type}
            </span>
          </div>
          {attribute.description && (
            <p className="text-xs text-slate-500 mt-2 line-clamp-1">{attribute.description}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            title="Edit"
          >
            <Edit2 size={16} className="text-slate-500" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete"
          >
            <Trash2 size={16} className="text-red-500" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// ATTRIBUTE EDITOR COMPONENT (for Flyout)
// ============================================

interface AttributeEditorProps {
  attribute: CustomAttribute;
  onSave: (attribute: CustomAttribute) => void;
  onCancel: () => void;
}

function AttributeEditor({ attribute, onSave, onCancel }: AttributeEditorProps) {
  const [editedAttribute, setEditedAttribute] = useState<CustomAttribute>(attribute);
  const [enumValue, setEnumValue] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);

  const updateAttribute = (updates: Partial<CustomAttribute>) => {
    setEditedAttribute({ ...editedAttribute, ...updates });
    if (updates.name !== undefined) {
      const validation = validateAttributeName(updates.name);
      setNameError(validation.valid ? null : validation.error || null);
    }
  };

  const addEnumValue = () => {
    if (!enumValue.trim()) return;
    const currentValues = editedAttribute.enumValues || [];
    if (!currentValues.includes(enumValue.trim())) {
      updateAttribute({ enumValues: [...currentValues, enumValue.trim()] });
    }
    setEnumValue('');
  };

  const removeEnumValue = (value: string) => {
    updateAttribute({
      enumValues: (editedAttribute.enumValues || []).filter((v) => v !== value),
    });
  };

  const handleSave = () => {
    if (nameError) return;
    if (!editedAttribute.name || !editedAttribute.displayName) return;
    if (
      (editedAttribute.type === 'enum' || editedAttribute.type === 'multiSelect') &&
      (!editedAttribute.enumValues || editedAttribute.enumValues.length === 0)
    ) {
      return;
    }
    onSave(editedAttribute);
  };

  const needsEnumValues = editedAttribute.type === 'enum' || editedAttribute.type === 'multiSelect';
  const isValid =
    editedAttribute.name &&
    editedAttribute.displayName &&
    !nameError &&
    (!needsEnumValues || (editedAttribute.enumValues && editedAttribute.enumValues.length > 0));

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Names */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              API Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={editedAttribute.name}
              onChange={(e) => updateAttribute({ name: e.target.value })}
              className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 font-mono text-sm transition-all ${
                nameError ? 'border-red-300 bg-red-50' : 'border-slate-200'
              }`}
              placeholder="field_name"
            />
            {nameError ? (
              <p className="text-xs text-red-600 mt-1.5">{nameError}</p>
            ) : (
              <p className="text-xs text-slate-500 mt-1.5">
                Lowercase, numbers, underscores
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Display Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={editedAttribute.displayName}
              onChange={(e) => updateAttribute({ displayName: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
              placeholder="Field Name"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Description
          </label>
          <textarea
            value={editedAttribute.description || ''}
            onChange={(e) => updateAttribute({ description: e.target.value })}
            rows={2}
            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all resize-none"
            placeholder="Describe what this attribute represents..."
          />
        </div>

        {/* Type Selection */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-3">
            Type <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {ATTRIBUTE_TYPES.map((type) => (
              <button
                key={type.value}
                onClick={() => updateAttribute({ type: type.value })}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all duration-200 ${
                  editedAttribute.type === type.value
                    ? 'bg-blue-50 border-blue-400 text-blue-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <span className="text-lg w-6 text-center">{type.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{type.label}</div>
                  <div className="text-xs opacity-70 truncate">{type.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Enum Values */}
        {needsEnumValues && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Values <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={enumValue}
                onChange={(e) => setEnumValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addEnumValue();
                  }
                }}
                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500"
                placeholder="Add a value..."
              />
              <button
                onClick={addEnumValue}
                className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(editedAttribute.enumValues || []).map((value) => (
                <span
                  key={value}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-sm"
                >
                  {value}
                  <button
                    onClick={() => removeEnumValue(value)}
                    className="hover:bg-slate-200 rounded-full p-0.5 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Help Text */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Help Text
          </label>
          <input
            type="text"
            value={editedAttribute.helpText || ''}
            onChange={(e) => updateAttribute({ helpText: e.target.value })}
            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
            placeholder="Optional hint text shown to users"
          />
        </div>

        {/* Options */}
        <div className="flex gap-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={editedAttribute.isRequired}
              onChange={(e) => updateAttribute({ isRequired: e.target.checked })}
              className="w-5 h-5 text-blue-600 rounded-md focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm text-slate-700">Required field</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={editedAttribute.isMultiValued}
              onChange={(e) => updateAttribute({ isMultiValued: e.target.checked })}
              className="w-5 h-5 text-blue-600 rounded-md focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm text-slate-700">Allow multiple values</span>
          </label>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3">
        <button
          onClick={onCancel}
          className="px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!isValid}
          className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-blue-500/20 transition-all"
        >
          Save Attribute
        </button>
      </div>
    </div>
  );
}

// ============================================
// SCHEMA PREVIEW COMPONENT
// ============================================

interface SchemaPreviewProps {
  schema: CustomMetadataDesign;
}

function SchemaPreview({ schema }: SchemaPreviewProps) {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200">
        <h4 className="text-xl font-semibold text-slate-900">{schema.displayName}</h4>
        {schema.description && (
          <p className="text-sm text-slate-600 mt-1">{schema.description}</p>
        )}
        {schema.appliesTo.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {schema.appliesTo.map((assetType) => {
              const Icon = ASSET_TYPE_ICONS[assetType] || Database;
              return (
                <span
                  key={assetType}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium"
                >
                  <Icon size={12} />
                  {assetType}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Preview Form */}
      <div className="space-y-5">
        {schema.attributes
          .sort((a, b) => a.order - b.order)
          .map((attr) => (
            <PreviewField key={attr.id} attribute={attr} />
          ))}
      </div>

      {schema.attributes.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          No attributes defined yet
        </div>
      )}
    </div>
  );
}

interface PreviewFieldProps {
  attribute: CustomAttribute;
}

function PreviewField({ attribute }: PreviewFieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-700">
        {attribute.displayName}
        {attribute.isRequired && <span className="text-red-500 ml-1">*</span>}
        {attribute.isMultiValued && (
          <span className="ml-2 text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">
            multiple
          </span>
        )}
      </label>
      {attribute.description && (
        <p className="text-xs text-slate-500">{attribute.description}</p>
      )}

      {/* Type-specific preview input */}
      {attribute.type === 'string' && (
        <input
          type="text"
          disabled
          className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50"
          placeholder={attribute.helpText || `Enter ${attribute.displayName.toLowerCase()}`}
        />
      )}
      {attribute.type === 'number' && (
        <input
          type="number"
          disabled
          className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50"
          placeholder={attribute.helpText || '0'}
        />
      )}
      {attribute.type === 'boolean' && (
        <div className="flex items-center gap-3">
          <input type="checkbox" disabled className="w-5 h-5 text-blue-600 rounded-md" />
          <span className="text-sm text-slate-600">
            {attribute.helpText || 'Enable this option'}
          </span>
        </div>
      )}
      {(attribute.type === 'date' || attribute.type === 'datetime') && (
        <input
          type="date"
          disabled
          className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50"
        />
      )}
      {(attribute.type === 'enum' || attribute.type === 'multiSelect') && (
        <select
          disabled
          multiple={attribute.type === 'multiSelect'}
          className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50"
        >
          <option>Select {attribute.displayName.toLowerCase()}</option>
          {attribute.enumValues?.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      )}
      {(attribute.type === 'user' || attribute.type === 'group') && (
        <div className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-400 text-sm">
          Select {attribute.type}...
        </div>
      )}
      {attribute.type === 'url' && (
        <input
          type="url"
          disabled
          className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50"
          placeholder={attribute.helpText || 'https://example.com'}
        />
      )}
      {attribute.type === 'sql' && (
        <textarea
          disabled
          rows={3}
          className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 font-mono text-sm"
          placeholder={attribute.helpText || 'SELECT * FROM table'}
        />
      )}

      {attribute.helpText && !['boolean'].includes(attribute.type) && (
        <p className="text-xs text-slate-400 flex items-center gap-1">
          <Info size={12} />
          {attribute.helpText}
        </p>
      )}
    </div>
  );
}

export default CustomMetadataDesignerScratch;
