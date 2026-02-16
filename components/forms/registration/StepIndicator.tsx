'use client';

import { STEP_LABELS, STEP_KEYS, type Step } from './types';

interface StepIndicatorProps {
  currentStep: Step;
}

export default function StepIndicator({ currentStep }: StepIndicatorProps) {
  const currentStepIndex = STEP_KEYS.indexOf(currentStep);

  return (
    <div className="flex items-center justify-center gap-1.5 sm:gap-2 mb-6 sm:mb-8 px-2">
      {STEP_LABELS.map((label, i) => {
        const isComplete = currentStepIndex > i;
        const isCurrent = currentStepIndex === i;
        return (
          <div key={label} className="flex items-center gap-1.5 sm:gap-2">
            {i > 0 && (
              <div className={`w-5 sm:w-8 h-0.5 rounded-full transition-snappy ${isComplete ? 'bg-brand' : 'bg-edge'}`} />
            )}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div
                className={`
                  w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold transition-snappy
                  ${isComplete ? 'bg-success text-white' : isCurrent ? 'bg-brand text-white' : 'bg-surface border border-edge text-muted'}
                `}
              >
                {isComplete ? <i className="fas fa-check text-xs" /> : i + 1}
              </div>
              <span className={`text-sm font-medium hidden sm:inline ${isCurrent ? 'text-heading' : 'text-muted'}`}>
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
