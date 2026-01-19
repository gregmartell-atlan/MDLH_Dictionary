/**
 * Wizard Step 2: User Stories
 * 
 * Select and customize user stories from the library.
 */

import { useAssistantStore } from '../../stores/assistantStore';
import { X, Plus } from 'lucide-react';

export function WizardStep2UserStories() {
  const { wizardState, removeUserStory } = useAssistantStore();
  const { selectedUserStories } = wizardState;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Review Recommended User Stories</h2>
        <p className="text-slate-600">
          Based on your profile, we've selected user stories from customers with similar needs. Accept, edit, or remove stories as needed.
        </p>
      </div>

      {/* Selected User Stories */}
      <div className="space-y-3">
        {selectedUserStories.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-lg border-2 border-dashed border-slate-300">
            <p className="text-slate-600">No user stories selected yet.</p>
            <button className="mt-4 px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700">
              <Plus className="w-4 h-4 inline mr-1" />
              Add User Story
            </button>
          </div>
        ) : (
          selectedUserStories.map((story) => (
            <div
              key={story.id}
              className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                      {story.role}
                    </span>
                    {story.domain && (
                      <span className="px-2 py-1 text-xs font-medium bg-slate-100 text-slate-700 rounded">
                        {story.domain}
                      </span>
                    )}
                    {story.pattern && (
                      <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded">
                        {story.pattern}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-900 font-medium mb-2">{story.textFull}</p>
                  <div className="flex flex-wrap gap-2">
                    {story.daapDimensions.map((dim) => (
                      <span
                        key={dim}
                        className="px-2 py-0.5 text-xs bg-emerald-50 text-emerald-700 rounded"
                      >
                        {dim}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => removeUserStory(story.id)}
                  className="ml-4 p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900">
          <strong>Tip:</strong> These user stories will guide your metadata model. Each story maps to specific
          metadata elements and enrichment techniques.
        </p>
      </div>
    </div>
  );
}
