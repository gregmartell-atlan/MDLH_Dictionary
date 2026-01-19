/**
 * Wizard Step 4: Implementation Plan
 * 
 * Review the generated roadmap and finalize the project.
 */

import React from 'react';
import { useAssistantStore } from '../../../stores/assistantStore';
import { Calendar, CheckCircle2, Clock, Target, Users, FileText, AlertCircle } from 'lucide-react';

export function WizardStep4Plan() {
  const { wizardState } = useAssistantStore();
  const { profile, draftMetadataModel, selectedTechniques, proposedRoadmap, stakeholders } = wizardState;

  // Calculate summary metrics
  const totalFields = draftMetadataModel.length;
  const requiredFields = draftMetadataModel.filter(f => f.required).length;
  const totalWeeks = proposedRoadmap?.totalWeeks || 8;

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">
          Review Your Implementation Plan
        </h2>
        <p className="text-sm text-slate-500">
          Based on your selections, we've generated a roadmap for implementing your metadata model.
          Review the summary and click "Create Project" to get started.
        </p>
      </div>

      {/* Project Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-slate-200 rounded-lg text-center">
          <div className="w-10 h-10 mx-auto mb-2 bg-blue-100 rounded-full flex items-center justify-center">
            <Target className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{profile.useCases?.length || 0}</div>
          <div className="text-xs text-slate-500">Use Cases</div>
        </div>
        
        <div className="p-4 bg-white border border-slate-200 rounded-lg text-center">
          <div className="w-10 h-10 mx-auto mb-2 bg-emerald-100 rounded-full flex items-center justify-center">
            <FileText className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{totalFields}</div>
          <div className="text-xs text-slate-500">Fields</div>
        </div>
        
        <div className="p-4 bg-white border border-slate-200 rounded-lg text-center">
          <div className="w-10 h-10 mx-auto mb-2 bg-purple-100 rounded-full flex items-center justify-center">
            <Clock className="w-5 h-5 text-purple-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{totalWeeks}</div>
          <div className="text-xs text-slate-500">Weeks</div>
        </div>
        
        <div className="p-4 bg-white border border-slate-200 rounded-lg text-center">
          <div className="w-10 h-10 mx-auto mb-2 bg-orange-100 rounded-full flex items-center justify-center">
            <Users className="w-5 h-5 text-orange-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{profile.connectors?.length || 0}</div>
          <div className="text-xs text-slate-500">Connectors</div>
        </div>
      </div>

      {/* Project Details */}
      <div className="p-4 bg-white border border-slate-200 rounded-lg space-y-4">
        <h3 className="font-medium text-slate-900">Project Details</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-slate-500">Project Name:</span>
            <span className="ml-2 font-medium text-slate-900">
              {profile.projectName || `${profile.industry || 'Metadata'} Model`}
            </span>
          </div>
          <div>
            <span className="text-slate-500">Industry:</span>
            <span className="ml-2 font-medium text-slate-900">
              {profile.industry || 'Not specified'}
            </span>
          </div>
          <div className="md:col-span-2">
            <span className="text-slate-500">Domains:</span>
            <span className="ml-2 font-medium text-slate-900">
              {profile.domains?.length > 0 ? profile.domains.join(', ') : 'Not specified'}
            </span>
          </div>
        </div>
      </div>

      {/* Roadmap Timeline */}
      {proposedRoadmap && proposedRoadmap.milestones && (
        <div className="space-y-4">
          <h3 className="font-medium text-slate-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-slate-400" />
            Implementation Roadmap
          </h3>
          
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200" />
            
            {/* Milestones */}
            <div className="space-y-6">
              {proposedRoadmap.milestones.map((milestone, idx) => (
                <div key={milestone.id} className="relative pl-10">
                  {/* Timeline dot */}
                  <div className={`absolute left-2.5 w-3 h-3 rounded-full border-2 ${
                    idx === 0 
                      ? 'bg-blue-500 border-blue-500' 
                      : 'bg-white border-slate-300'
                  }`} />
                  
                  <div className="p-4 bg-white border border-slate-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-slate-900">{milestone.name}</h4>
                      <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                        Week {milestone.week}
                      </span>
                    </div>
                    
                    {milestone.description && (
                      <p className="text-sm text-slate-500 mb-3">{milestone.description}</p>
                    )}
                    
                    {/* Tasks */}
                    <div className="space-y-1.5">
                      {milestone.tasks.map((task, taskIdx) => (
                        <div key={taskIdx} className="flex items-center gap-2 text-sm text-slate-600">
                          <CheckCircle2 className="w-4 h-4 text-slate-300" />
                          {task}
                        </div>
                      ))}
                    </div>
                    
                    {/* Deliverables */}
                    {milestone.deliverables && milestone.deliverables.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <div className="text-xs text-slate-500 mb-1">Deliverables:</div>
                        <div className="flex flex-wrap gap-1">
                          {milestone.deliverables.map((d, dIdx) => (
                            <span key={dIdx} className="text-xs px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded">
                              {d}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Selected Fields Summary */}
      <div className="space-y-3">
        <h3 className="font-medium text-slate-900">Selected Metadata Fields</h3>
        
        {draftMetadataModel.length > 0 ? (
          <div className="p-4 bg-slate-50 rounded-lg">
            <div className="flex flex-wrap gap-2">
              {draftMetadataModel.map(field => (
                <span
                  key={field.id}
                  className={`px-3 py-1.5 rounded-full text-sm ${
                    field.required
                      ? 'bg-blue-100 text-blue-800 font-medium'
                      : 'bg-white text-slate-700 border border-slate-200'
                  }`}
                >
                  {field.fieldName}
                  {field.required && ' ★'}
                </span>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-3">
              ★ = Required field • {requiredFields} required, {totalFields - requiredFields} optional
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm">No fields selected. Go back to add fields to your model.</span>
          </div>
        )}
      </div>

      {/* Next Steps */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-medium text-blue-900 mb-2">What Happens Next</h3>
        <ul className="text-sm text-blue-800 space-y-2">
          <li className="flex items-start gap-2">
            <span className="text-blue-500 font-bold">1.</span>
            Your project will be created and saved
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-500 font-bold">2.</span>
            You can run an assessment against your MDLH data to measure current coverage
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-500 font-bold">3.</span>
            The gaps report will show which fields need enrichment
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-500 font-bold">4.</span>
            Use the roadmap to guide your implementation
          </li>
        </ul>
      </div>
    </div>
  );
}

export default WizardStep4Plan;
