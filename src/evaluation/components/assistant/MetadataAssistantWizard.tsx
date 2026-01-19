/**
 * Metadata Modeling Assistant Wizard
 * 
 * Multi-step wizard for creating metadata models with guidance
 * from embedded templates and customer reference implementations.
 */

import { useEffect } from 'react';
import { useAssistantStore } from '../../stores/assistantStore';
import { useModelStore } from '../../stores/modelStore';
import { convertProjectToPlan } from '../../utils/projectToPlan';
import { WizardStep0StrategyScout } from './WizardStep0StrategyScout';
import { WizardStep1Profile } from './WizardStep1Profile';
import { WizardStep2UserStories } from './WizardStep2UserStories';
import { WizardStep3MetadataModel } from './WizardStep3MetadataModel';
import { WizardStep4Enrichment } from './WizardStep4Enrichment';
import { WizardStep5Roadmap } from './WizardStep5Roadmap';
import { CheckCircle2 } from 'lucide-react';

interface MetadataAssistantWizardProps {
  onComplete?: () => void;
}

export function MetadataAssistantWizard({ onComplete }: MetadataAssistantWizardProps) {
  const { wizardState, initializeWizard, nextStep, previousStep, finalizeWizard } = useAssistantStore();
  const { currentStep, totalSteps } = wizardState;

  useEffect(() => {
    // Initialize wizard on mount if needed
    if (currentStep === 0 && wizardState.selectedUserStories.length === 0) {
      initializeWizard();
    }
  }, []);

  const handleNext = () => {
    // Generate recommendations when moving between certain steps
    if (currentStep === 1) {
      // After profile, generate user story recommendations
      useAssistantStore.getState().generateRecommendedUserStories();
    } else if (currentStep === 2) {
      // After user stories, generate metadata model recommendations
      useAssistantStore.getState().generateRecommendedMetadataModel();
    } else if (currentStep === 4) {
      // After enrichment techniques, generate roadmap
      useAssistantStore.getState().generateProjectRoadmap();
    }
    nextStep();
  };

  const handleFinalize = () => {
    const project = finalizeWizard();
    if (project) {
      // Convert project to enrichment plan and add to model store
      const plan = convertProjectToPlan(project);
      useModelStore.getState().addPlan(plan);
      useModelStore.getState().setActivePlanId(plan.id);

      // Navigate to project view
      if (onComplete) {
        onComplete();
      }
    }
  };

  const steps = [
    { number: 0, name: 'Strategy Scout', component: WizardStep0StrategyScout },
    { number: 1, name: 'Profile', component: WizardStep1Profile },
    { number: 2, name: 'User Stories', component: WizardStep2UserStories },
    { number: 3, name: 'Metadata Model', component: WizardStep3MetadataModel },
    { number: 4, name: 'Enrichment', component: WizardStep4Enrichment },
    { number: 5, name: 'Roadmap', component: WizardStep5Roadmap },
  ];

  const CurrentStepComponent = steps[currentStep]?.component;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-8 py-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold text-slate-900">Metadata Modeling Assistant</h1>
          <p className="text-slate-600 mt-1">
            Build your metadata model with guidance from proven customer templates
          </p>
        </div>
      </div>

      {/* Progress Stepper */}
      <div className="bg-white border-b border-slate-200 px-8 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            {steps.map((step, idx) => (
              <div key={step.number} className="flex items-center flex-1">
                <div className="flex items-center">
                  {/* Step circle */}
                  <div
                    className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all ${
                      idx < currentStep
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : idx === currentStep
                        ? 'bg-blue-500 border-blue-500 text-white'
                        : 'bg-white border-slate-300 text-slate-400'
                    }`}
                  >
                    {idx < currentStep ? (
                      <CheckCircle2 className="w-6 h-6" />
                    ) : (
                      <span className="text-sm font-semibold">{step.number}</span>
                    )}
                  </div>
                  {/* Step name */}
                  <div className="ml-3">
                    <p
                      className={`text-sm font-medium ${
                        idx <= currentStep ? 'text-slate-900' : 'text-slate-400'
                      }`}
                    >
                      {step.name}
                    </p>
                  </div>
                </div>
                {/* Connector line */}
                {idx < steps.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-4 ${
                      idx < currentStep ? 'bg-emerald-500' : 'bg-slate-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Step Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-8 py-8">
          {CurrentStepComponent && <CurrentStepComponent />}
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="bg-white border-t border-slate-200 px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button
            onClick={previousStep}
            disabled={currentStep === 0}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>

          <div className="text-sm text-slate-600">
            Step {currentStep + 1} of {totalSteps}
          </div>

          {currentStep < totalSteps - 1 ? (
            <button
              onClick={handleNext}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleFinalize}
              className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700"
            >
              Finalize & Create Project
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
