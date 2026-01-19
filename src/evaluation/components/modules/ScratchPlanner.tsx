import { useState } from 'react';
import { FieldSelector } from './FieldSelector';
import { CustomMetadataDesignerScratch } from './CustomMetadataDesignerScratch';
import { Database, Sparkles } from 'lucide-react';

export function ScratchPlanner() {
  const [activeTab, setActiveTab] = useState<'fields' | 'custom'>('fields');

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Scratch Planner</h1>
            <p className="text-slate-500 mt-1">
              Design your metadata model from scratch or refine existing plans.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('fields')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'fields'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Sparkles size={16} />
            Field Requirements
          </button>
          <button
            onClick={() => setActiveTab('custom')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'custom'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Database size={16} />
            Custom Metadata
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'fields' ? (
          <FieldSelector />
        ) : (
          <CustomMetadataDesignerScratch />
        )}
      </div>
    </div>
  );
}
