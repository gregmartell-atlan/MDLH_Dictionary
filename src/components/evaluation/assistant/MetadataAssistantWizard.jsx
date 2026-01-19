/**
 * Metadata Modeling Assistant Wizard
 * 
 * Multi-step wizard for creating metadata models with guidance.
 * Adapted for MDLH Explorer.
 */

import React, { useEffect, useCallback } from 'react';
import { useAssistantStore } from '../../../stores/assistantStore';
import { CheckCircle2, ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import WizardStep1Profile from './WizardStep1Profile';
import WizardStep2UseCases from './WizardStep2UseCases';
import WizardStep3Fields from './WizardStep3Fields';
import WizardStep4Plan from './WizardStep4Plan';

/**
 * @typedef {Object} MetadataAssistantWizardProps
 * @property {Function} [onComplete] - Callback when wizard is finalized
 * @property {Function} [onClose] - Callback to close wizard
 */

/**
 * Main wizard component
 * @param {MetadataAssistantWizardProps} props
 */
export function MetadataAssistantWizard({ onComplete, onClose }) {
  const { 
    wizardState, 
    initializeWizard, 
    nextStep, 
    previousStep, 
    finalizeWizard,
    resetWizard,
    generateSimpleRoadmap,
  } = useAssistantStore();
  
  const { currentStep, totalSteps } = wizardState;

  // Initialize wizard on mount
  useEffect(() => {
    if (currentStep === 0 && wizardState.selectedUserStories.length === 0) {
      initializeWizard();
    }
  }, [currentStep, wizardState.selectedUserStories.length, initializeWizard]);

  // Handle next step with any necessary generation
  const handleNext = useCallback(() => {
    if (currentStep === 2) {
      // After selecting fields, generate a simple roadmap
      generateSimpleRoadmap();
    }
    nextStep();
  }, [currentStep, nextStep, generateSimpleRoadmap]);

  // Handle finalize
  const handleFinalize = useCallback(() => {
    const project = finalizeWizard();
    if (project && onComplete) {
      onComplete(project);
    }
  }, [finalizeWizard, onComplete]);

  // Handle close/cancel
  const handleClose = useCallback(() => {
    resetWizard();
    if (onClose) onClose();
  }, [resetWizard, onClose]);

  // Step definitions - simplified for MDLH
  const steps = [
    { number: 0, name: 'Profile', description: 'Configure your profile' },
    { number: 1, name: 'Use Cases', description: 'Select target use cases' },
    { number: 2, name: 'Fields', description: 'Define metadata fields' },
    { number: 3, name: 'Plan', description: 'Review implementation plan' },
  ];

  // Render current step
  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <WizardStep1Profile />;
      case 1:
        return <WizardStep2UseCases />;
      case 2:
        return <WizardStep3Fields />;
      case 3:
        return <WizardStep4Plan />;
      default:
        return <WizardStep1Profile />;
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Sparkles className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Metadata Modeling Assistant</h1>
              <p className="text-sm text-slate-500">
                Build your metadata model with guided recommendations
              </p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={handleClose}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Progress Stepper */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between max-w-3xl mx-auto">
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
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <span className="text-sm font-semibold">{step.number + 1}</span>
                  )}
                </div>
                {/* Step name */}
                <div className="ml-3 hidden sm:block">
                  <p
                    className={`text-sm font-medium ${
                      idx <= currentStep ? 'text-slate-900' : 'text-slate-400'
                    }`}
                  >
                    {step.name}
                  </p>
                  <p className="text-xs text-slate-500">{step.description}</p>
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

      {/* Step Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto px-6 py-6">
          {renderStep()}
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="bg-white border-t border-slate-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={previousStep}
            disabled={currentStep === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Previous
          </button>

          <div className="text-sm text-slate-600">
            Step {currentStep + 1} of {steps.length}
          </div>

          {currentStep < steps.length - 1 ? (
            <button
              onClick={handleNext}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Next
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleFinalize}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              Create Project
            </button>
          )}
        </div>
      </div>

      <style>{`
        /* Wizard-specific styles */
      `}</style>
    </div>
  );
}

export default MetadataAssistantWizard;
