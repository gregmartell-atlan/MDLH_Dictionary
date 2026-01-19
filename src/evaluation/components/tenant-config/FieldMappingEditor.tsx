/**
 * Field Mapping Editor
 *
 * Side panel for editing a single field mapping.
 * Allows selecting source type and configuring source-specific options.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  useTenantConfigStore,
  TenantFieldMapping,
  FieldSource,
} from '../../stores/tenantConfigStore';

// ============================================
// TYPES
// ============================================

type SourceType = 'native' | 'native_any' | 'custom_metadata' | 'classification' | 'relationship' | 'derived';

// ============================================
// SOURCE TYPE SELECTOR
// ============================================

interface SourceTypeSelectorProps {
  value: SourceType;
  onChange: (type: SourceType) => void;
}

function SourceTypeSelector({ value, onChange }: SourceTypeSelectorProps) {
  const options: Array<{ value: SourceType; label: string; description: string }> = [
    { value: 'native', label: 'Native Attribute', description: 'Single Atlan attribute' },
    { value: 'native_any', label: 'Native (Any)', description: 'First available from list' },
    { value: 'custom_metadata', label: 'Custom Metadata', description: 'Business attribute field' },
    { value: 'classification', label: 'Classification', description: 'Tag or classification' },
    { value: 'relationship', label: 'Relationship', description: 'Linked entity presence' },
    { value: 'derived', label: 'Derived', description: 'Custom computation' },
  ];

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        Source Type
      </label>
      <div className="grid grid-cols-2 gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`p-3 text-left rounded-lg border-2 transition-colors ${
              value === opt.value
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="font-medium text-sm">{opt.label}</div>
            <div className="text-xs text-gray-500 mt-0.5">{opt.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================
// NATIVE ATTRIBUTE FORM
// ============================================

interface NativeAttributeFormProps {
  value: string;
  onChange: (value: string) => void;
  suggestions?: string[];
}

function NativeAttributeForm({ value, onChange, suggestions = [] }: NativeAttributeFormProps) {
  const commonAttributes = [
    'ownerUsers',
    'ownerGroups',
    'description',
    'userDescription',
    'certificateStatus',
    'readme',
    'displayName',
    'qualifiedName',
  ];

  const allSuggestions = [...new Set([...suggestions, ...commonAttributes])];

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Attribute Name
        </label>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g., ownerUsers"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {allSuggestions.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Common Attributes
          </label>
          <div className="flex flex-wrap gap-1">
            {allSuggestions.slice(0, 10).map((attr) => (
              <button
                key={attr}
                onClick={() => onChange(attr)}
                className={`px-2 py-1 text-xs rounded border transition-colors ${
                  value === attr
                    ? 'bg-blue-100 border-blue-300 text-blue-700'
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
              >
                {attr}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// NATIVE ANY FORM
// ============================================

interface NativeAnyFormProps {
  value: string[];
  onChange: (value: string[]) => void;
}

function NativeAnyForm({ value, onChange }: NativeAnyFormProps) {
  const [inputValue, setInputValue] = useState('');

  const handleAdd = () => {
    if (inputValue.trim() && !value.includes(inputValue.trim())) {
      onChange([...value, inputValue.trim()]);
      setInputValue('');
    }
  };

  const handleRemove = (attr: string) => {
    onChange(value.filter((v) => v !== attr));
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Attributes (checked in order)
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="Add attribute..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            onClick={handleAdd}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Add
          </button>
        </div>
      </div>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((attr, index) => (
            <div
              key={attr}
              className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-lg"
            >
              <span className="text-xs text-gray-500">{index + 1}.</span>
              <span className="text-sm">{attr}</span>
              <button
                onClick={() => handleRemove(attr)}
                className="ml-1 text-gray-400 hover:text-red-600"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// CUSTOM METADATA FORM
// ============================================

interface CustomMetadataFormProps {
  businessAttribute: string;
  attribute: string;
  onChange: (ba: string, attr: string) => void;
  availableMetadata?: Array<{
    name: string;
    displayName: string;
    attributes: Array<{ name: string; displayName: string }>;
  }>;
}

function CustomMetadataForm({
  businessAttribute,
  attribute,
  onChange,
  availableMetadata = [],
}: CustomMetadataFormProps) {
  const selectedBA = availableMetadata.find((m) => m.name === businessAttribute);

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Business Attribute Set
        </label>
        <select
          value={businessAttribute}
          onChange={(e) => onChange(e.target.value, '')}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Select...</option>
          {availableMetadata.map((m) => (
            <option key={m.name} value={m.name}>
              {m.displayName || m.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Attribute
        </label>
        <select
          value={attribute}
          onChange={(e) => onChange(businessAttribute, e.target.value)}
          disabled={!selectedBA}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
        >
          <option value="">Select...</option>
          {selectedBA?.attributes.map((a) => (
            <option key={a.name} value={a.name}>
              {a.displayName || a.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

// ============================================
// CLASSIFICATION FORM
// ============================================

interface ClassificationFormProps {
  pattern: string;
  onChange: (pattern: string) => void;
  availableClassifications?: Array<{ name: string; displayName: string }>;
}

function ClassificationForm({
  pattern,
  onChange,
  availableClassifications = [],
}: ClassificationFormProps) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Classification Pattern (regex)
        </label>
        <input
          type="text"
          value={pattern}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g., PII|Sensitive"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {availableClassifications.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Available Classifications
          </label>
          <div className="flex flex-wrap gap-1">
            {availableClassifications.slice(0, 10).map((c) => (
              <button
                key={c.name}
                onClick={() => onChange(c.name)}
                className="px-2 py-1 text-xs rounded bg-pink-50 border border-pink-200 text-pink-700 hover:bg-pink-100"
              >
                {c.displayName || c.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// RELATIONSHIP FORM
// ============================================

interface RelationshipFormProps {
  relation: string;
  countThreshold: number;
  onChange: (relation: string, threshold: number) => void;
}

function RelationshipForm({ relation, countThreshold, onChange }: RelationshipFormProps) {
  const commonRelations = [
    'meanings',
    'inputToProcesses',
    'outputFromProcesses',
    'policies',
    'seeAlso',
  ];

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Relationship Type
        </label>
        <input
          type="text"
          value={relation}
          onChange={(e) => onChange(e.target.value, countThreshold)}
          placeholder="e.g., meanings"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div className="flex flex-wrap gap-1">
        {commonRelations.map((r) => (
          <button
            key={r}
            onClick={() => onChange(r, countThreshold)}
            className={`px-2 py-1 text-xs rounded border transition-colors ${
              relation === r
                ? 'bg-orange-100 border-orange-300 text-orange-700'
                : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Minimum Count
        </label>
        <input
          type="number"
          value={countThreshold}
          onChange={(e) => onChange(relation, parseInt(e.target.value) || 0)}
          min={0}
          className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
    </div>
  );
}

// ============================================
// MAIN EDITOR COMPONENT
// ============================================

interface FieldMappingEditorProps {
  fieldId: string;
  onClose?: () => void;
}

export function FieldMappingEditor({ fieldId, onClose }: FieldMappingEditorProps) {
  const { config, schemaSnapshot, overrideMapping, confirmMapping, rejectMapping, excludeField } =
    useTenantConfigStore();

  const mapping = useMemo(
    () => config?.fieldMappings.find((m) => m.canonicalFieldId === fieldId),
    [config, fieldId]
  );

  // Local form state
  const [sourceType, setSourceType] = useState<SourceType>('native');
  const [nativeAttr, setNativeAttr] = useState('');
  const [nativeAnyAttrs, setNativeAnyAttrs] = useState<string[]>([]);
  const [cmBusinessAttr, setCmBusinessAttr] = useState('');
  const [cmAttr, setCmAttr] = useState('');
  const [classPattern, setClassPattern] = useState('');
  const [relationType, setRelationType] = useState('');
  const [relationThreshold, setRelationThreshold] = useState(1);

  // Initialize form from existing mapping
  useEffect(() => {
    if (mapping?.tenantSource) {
      const source = mapping.tenantSource;
      setSourceType(source.type as SourceType);

      switch (source.type) {
        case 'native':
          setNativeAttr((source.attribute as string) || '');
          break;
        case 'native_any':
          setNativeAnyAttrs((source.attributes as string[]) || []);
          break;
        case 'custom_metadata':
          setCmBusinessAttr((source.businessAttribute as string) || '');
          setCmAttr((source.attribute as string) || '');
          break;
        case 'classification':
          setClassPattern((source.pattern as string) || (source.tag as string) || '');
          break;
        case 'relationship':
          setRelationType((source.relation as string) || '');
          setRelationThreshold((source.countThreshold as number) || 1);
          break;
      }
    }
  }, [mapping]);

  if (!mapping) {
    return (
      <div className="p-6 text-center text-gray-500">
        Field not found
      </div>
    );
  }

  const buildSource = (): FieldSource => {
    switch (sourceType) {
      case 'native':
        return { type: 'native', attribute: nativeAttr };
      case 'native_any':
        return { type: 'native_any', attributes: nativeAnyAttrs };
      case 'custom_metadata':
        return { type: 'custom_metadata', businessAttribute: cmBusinessAttr, attribute: cmAttr };
      case 'classification':
        return { type: 'classification', pattern: classPattern };
      case 'relationship':
        return { type: 'relationship', relation: relationType, countThreshold: relationThreshold };
      case 'derived':
        return { type: 'derived', derivation: 'custom' };
      default:
        return { type: 'native', attribute: '' };
    }
  };

  const handleSave = () => {
    overrideMapping(fieldId, buildSource());
    onClose?.();
  };

  const handleConfirm = () => {
    confirmMapping(fieldId);
    onClose?.();
  };

  const handleReject = () => {
    rejectMapping(fieldId);
    onClose?.();
  };

  const handleExclude = () => {
    excludeField(fieldId);
    onClose?.();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h3 className="font-semibold text-gray-900">{mapping.canonicalFieldName}</h3>
          <p className="text-xs text-gray-500 font-mono">{mapping.canonicalFieldId}</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Form */}
      <div className="flex-1 overflow-auto p-4 space-y-6">
        <SourceTypeSelector value={sourceType} onChange={setSourceType} />

        <div className="border-t pt-4">
          {sourceType === 'native' && (
            <NativeAttributeForm value={nativeAttr} onChange={setNativeAttr} />
          )}
          {sourceType === 'native_any' && (
            <NativeAnyForm value={nativeAnyAttrs} onChange={setNativeAnyAttrs} />
          )}
          {sourceType === 'custom_metadata' && (
            <CustomMetadataForm
              businessAttribute={cmBusinessAttr}
              attribute={cmAttr}
              onChange={(ba, attr) => {
                setCmBusinessAttr(ba);
                setCmAttr(attr);
              }}
              availableMetadata={schemaSnapshot?.customMetadata}
            />
          )}
          {sourceType === 'classification' && (
            <ClassificationForm
              pattern={classPattern}
              onChange={setClassPattern}
              availableClassifications={schemaSnapshot?.classifications}
            />
          )}
          {sourceType === 'relationship' && (
            <RelationshipForm
              relation={relationType}
              countThreshold={relationThreshold}
              onChange={(r, t) => {
                setRelationType(r);
                setRelationThreshold(t);
              }}
            />
          )}
          {sourceType === 'derived' && (
            <div className="text-sm text-gray-500 italic">
              Derived fields use custom computation logic.
            </div>
          )}
        </div>

        {mapping.notes && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="text-xs font-medium text-yellow-800">Notes</div>
            <div className="text-sm text-yellow-700 mt-1">{mapping.notes}</div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="border-t p-4 space-y-2">
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
          >
            Save Mapping
          </button>
          {mapping.status === 'pending' && (
            <button
              onClick={handleConfirm}
              className="px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700"
            >
              Confirm
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleReject}
            className="flex-1 px-4 py-2 border border-red-300 text-red-700 font-medium rounded-lg hover:bg-red-50"
          >
            Reject Mapping
          </button>
          <button
            onClick={handleExclude}
            className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
          >
            Exclude Field
          </button>
        </div>
      </div>
    </div>
  );
}

export default FieldMappingEditor;
