/**
 * GlossaryPlanner - Glossary structure design tool
 *
 * Features:
 * - Category hierarchy builder
 * - Term template configuration
 * - Approval workflow setup
 * - Naming convention rules
 */

import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Settings,
  Save,
  BookOpen,
  Building2,
  Layers,
  FileText,
  Users,
} from 'lucide-react';
import {
  GLOSSARY_TEMPLATES,
  createCategoryFromTemplate,
} from '../../types/glossary';
import type {
  GlossaryDesign,
  GlossaryCategory,
  GlossaryTemplate,
  ApprovalWorkflow,
} from '../../types/glossary';
import { createId } from '../../utils/id';

const TEMPLATE_ICONS: Record<string, typeof BookOpen> = {
  'by-domain': Building2,
  'by-type': Layers,
  'by-layer': FileText,
};

const CATEGORY_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
];

interface GlossaryPlannerProps {
  initialGlossary?: GlossaryDesign;
  onSave?: (glossary: GlossaryDesign) => void;
}

export function GlossaryPlanner({ initialGlossary, onSave }: GlossaryPlannerProps) {
  // URL state management
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryIdFromUrl = searchParams.get('category');

  const [step, setStep] = useState<'template' | 'design'>('template');
  const [glossary, setGlossary] = useState<GlossaryDesign | null>(initialGlossary || null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(categoryIdFromUrl);

  // Sync URL with selected category
  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedCategoryId) {
      params.set('category', selectedCategoryId);
    }
    setSearchParams(params, { replace: true });
  }, [selectedCategoryId, setSearchParams]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Handle template selection
  const handleSelectTemplate = (template: GlossaryTemplate) => {
    const categories = template.categories.map((cat, index) =>
      createCategoryFromTemplate(cat, `category-${index}`)
    );

    setGlossary({
      id: 'glossary-1',
      name: 'Business Glossary',
      description: template.description,
      categories,
      governanceModel: {
        defaultApprovalWorkflow: 'single',
        allowUserSuggestions: true,
        requireOwnerForTerms: true,
      },
      namingConventions: [],
    });

    setExpandedCategories(new Set(categories.map((c) => c.id)));
    setStep('design');
  };

  // Add a new category
  const addCategory = (parentId?: string) => {
    if (!glossary) return;

    const newCategory: GlossaryCategory = {
      id: createId('category'),
      name: 'New Category',
      description: '',
      color: CATEGORY_COLORS[glossary.categories.length % CATEGORY_COLORS.length],
      icon: 'folder',
      approvalWorkflow: 'single',
      termTemplate: {
        requiredFields: ['definition'],
        optionalFields: ['examples', 'relatedTerms'],
        customFields: [],
        exampleTerm: {},
      },
      domains: [],
      parentCategoryId: parentId,
      childCategoryIds: [],
      order: glossary.categories.length,
    };

    if (parentId) {
      setGlossary({
        ...glossary,
        categories: glossary.categories.map((c) =>
          c.id === parentId
            ? { ...c, childCategoryIds: [...c.childCategoryIds, newCategory.id] }
            : c
        ).concat(newCategory),
      });
      setExpandedCategories(new Set([...expandedCategories, parentId]));
    } else {
      setGlossary({
        ...glossary,
        categories: [...glossary.categories, newCategory],
      });
    }

    setSelectedCategoryId(newCategory.id);
  };

  // Delete category
  const deleteCategory = (categoryId: string) => {
    if (!glossary) return;

    const categoryToDelete = glossary.categories.find((c) => c.id === categoryId);
    if (!categoryToDelete) return;

    const updatedCategories = glossary.categories
      .filter((c) => c.id !== categoryId)
      .map((c) =>
        c.id === categoryToDelete.parentCategoryId
          ? {
              ...c,
              childCategoryIds: c.childCategoryIds.filter((id) => id !== categoryId),
            }
          : c
      );

    setGlossary({ ...glossary, categories: updatedCategories });
    if (selectedCategoryId === categoryId) {
      setSelectedCategoryId(null);
    }
  };

  // Update category
  const updateCategory = (categoryId: string, updates: Partial<GlossaryCategory>) => {
    if (!glossary) return;

    setGlossary({
      ...glossary,
      categories: glossary.categories.map((c) =>
        c.id === categoryId ? { ...c, ...updates } : c
      ),
    });
  };

  // Toggle expansion
  const toggleExpand = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  // Get root categories
  const rootCategories = useMemo(() => {
    if (!glossary) return [];
    return glossary.categories.filter((c) => !c.parentCategoryId);
  }, [glossary]);

  // Render category node
  const renderCategoryNode = (category: GlossaryCategory, level: number = 0) => {
    const childCategories =
      glossary?.categories.filter((c) => c.parentCategoryId === category.id) || [];
    const hasChildren = childCategories.length > 0;
    const isExpanded = expandedCategories.has(category.id);
    const isSelected = selectedCategoryId === category.id;

    return (
      <div key={category.id}>
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors group ${
            isSelected
              ? 'bg-blue-100 border border-blue-300'
              : 'hover:bg-slate-100'
          }`}
          style={{ paddingLeft: `${12 + level * 20}px` }}
          onClick={() => setSelectedCategoryId(category.id)}
        >
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(category.id);
              }}
              className="p-0.5 hover:bg-slate-200 rounded"
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : (
            <span className="w-5" />
          )}
          <div
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: category.color }}
          />
          <span className="flex-1 text-sm font-medium text-slate-800">
            {category.name}
          </span>
          <span className="text-xs text-slate-400">
            {category.approvalWorkflow === 'committee' && <Users size={12} />}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              addCategory(category.id);
            }}
            className="p-1 hover:bg-slate-200 rounded opacity-0 group-hover:opacity-100"
            title="Add sub-category"
          >
            <Plus size={14} className="text-slate-500" />
          </button>
        </div>
        {isExpanded &&
          childCategories.map((child) => renderCategoryNode(child, level + 1))}
      </div>
    );
  };

  // Template selection step
  if (step === 'template') {
    return (
      <div className="h-full flex flex-col bg-white">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900">Glossary Planner</h2>
          <p className="text-sm text-slate-500 mt-1">
            Design your glossary category structure
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {GLOSSARY_TEMPLATES.map((template) => {
              const Icon = TEMPLATE_ICONS[template.id] || BookOpen;
              return (
                <button
                  key={template.id}
                  onClick={() => handleSelectTemplate(template)}
                  className="p-6 rounded-xl border-2 border-slate-200 hover:border-blue-400 hover:shadow-lg transition-all text-left"
                >
                  <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center mb-4">
                    <Icon size={24} className="text-blue-600" />
                  </div>
                  <h3 className="font-semibold text-slate-900 mb-2">{template.name}</h3>
                  <p className="text-sm text-slate-500 mb-3">{template.description}</p>
                  <div className="text-xs text-slate-400">
                    Use case: {template.useCase}
                  </div>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => {
              setGlossary({
                id: 'glossary-1',
                name: 'Business Glossary',
                description: '',
                categories: [],
                governanceModel: {
                  defaultApprovalWorkflow: 'single',
                  allowUserSuggestions: true,
                  requireOwnerForTerms: true,
                },
                namingConventions: [],
              });
              setStep('design');
            }}
            className="w-full mt-4 p-4 rounded-lg border border-dashed border-slate-300 text-slate-600 hover:bg-slate-50"
          >
            Start from scratch
          </button>
        </div>
      </div>
    );
  }

  // Design step
  const selectedCategory = glossary?.categories.find(
    (c) => c.id === selectedCategoryId
  );

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              {glossary?.name || 'Glossary'}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {glossary?.categories.length || 0} categories defined
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setStep('template')}
              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              <Settings size={16} />
              Change Template
            </button>
            {onSave && glossary && (
              <button
                onClick={() => onSave(glossary)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
              >
                <Save size={16} />
                Save
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Category Tree */}
        <div className="w-80 border-r border-slate-200 flex flex-col">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">Categories</span>
            <button
              onClick={() => addCategory()}
              className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
            >
              <Plus size={14} />
              Add Category
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {rootCategories.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">
                No categories yet. Click "Add Category" to create one.
              </div>
            ) : (
              <div className="space-y-1">
                {rootCategories.map((category) => renderCategoryNode(category))}
              </div>
            )}
          </div>
        </div>

        {/* Category Editor */}
        <div className="flex-1 p-6 overflow-y-auto">
          {selectedCategory ? (
            <div className="max-w-2xl space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Category Name
                </label>
                <input
                  type="text"
                  value={selectedCategory.name}
                  onChange={(e) =>
                    updateCategory(selectedCategory.id, { name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  value={selectedCategory.description}
                  onChange={(e) =>
                    updateCategory(selectedCategory.id, {
                      description: e.target.value,
                    })
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Describe this category's purpose..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Color
                </label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORY_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() =>
                        updateCategory(selectedCategory.id, { color })
                      }
                      className={`w-8 h-8 rounded-lg border-2 transition-transform ${
                        selectedCategory.color === color
                          ? 'border-slate-900 scale-110'
                          : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Approval Workflow
                </label>
                <select
                  value={selectedCategory.approvalWorkflow}
                  onChange={(e) =>
                    updateCategory(selectedCategory.id, {
                      approvalWorkflow: e.target.value as ApprovalWorkflow,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="none">No approval required</option>
                  <option value="single">Single approver</option>
                  <option value="committee">Committee approval</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Required Term Fields
                </label>
                <div className="space-y-2">
                  {['definition', 'owner', 'formula', 'examples', 'relatedTerms', 'dataSource'].map(
                    (field) => {
                      const isRequired =
                        selectedCategory.termTemplate.requiredFields.includes(field);
                      const isOptional =
                        selectedCategory.termTemplate.optionalFields.includes(field);

                      return (
                        <div
                          key={field}
                          className="flex items-center justify-between py-2 border-b border-slate-100"
                        >
                          <span className="text-sm text-slate-700 capitalize">
                            {field.replace(/([A-Z])/g, ' $1')}
                          </span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                const newRequired = isRequired
                                  ? selectedCategory.termTemplate.requiredFields.filter(
                                      (f) => f !== field
                                    )
                                  : [
                                      ...selectedCategory.termTemplate.requiredFields,
                                      field,
                                    ];
                                const newOptional =
                                  selectedCategory.termTemplate.optionalFields.filter(
                                    (f) => f !== field
                                  );
                                updateCategory(selectedCategory.id, {
                                  termTemplate: {
                                    ...selectedCategory.termTemplate,
                                    requiredFields: newRequired,
                                    optionalFields: newOptional,
                                  },
                                });
                              }}
                              className={`px-2 py-1 text-xs rounded ${
                                isRequired
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                              }`}
                            >
                              Required
                            </button>
                            <button
                              onClick={() => {
                                const newOptional = isOptional
                                  ? selectedCategory.termTemplate.optionalFields.filter(
                                      (f) => f !== field
                                    )
                                  : [
                                      ...selectedCategory.termTemplate.optionalFields,
                                      field,
                                    ];
                                const newRequired =
                                  selectedCategory.termTemplate.requiredFields.filter(
                                    (f) => f !== field
                                  );
                                updateCategory(selectedCategory.id, {
                                  termTemplate: {
                                    ...selectedCategory.termTemplate,
                                    requiredFields: newRequired,
                                    optionalFields: newOptional,
                                  },
                                });
                              }}
                              className={`px-2 py-1 text-xs rounded ${
                                isOptional
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                              }`}
                            >
                              Optional
                            </button>
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200">
                <button
                  onClick={() => deleteCategory(selectedCategory.id)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 size={16} />
                  Delete Category
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400">
              Select a category to edit
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default GlossaryPlanner;
