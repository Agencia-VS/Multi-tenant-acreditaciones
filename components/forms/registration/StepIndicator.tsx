'use client';

import { STEP_LABELS, STEP_KEYS, type Step } from './types';

interface StepIndicatorProps {
  currentStep: Step;
}

export default function StepIndicator({ currentStep }: StepIndicatorProps) {
  const currentStepIndex = STEP_KEYS.indexOf(currentStep);

  return (
    <nav className="mb-6 sm:mb-8 px-2" aria-label="Progreso">
      {/* Progress bar (continuous) */}
      <div className="relative h-1 rounded-full bg-edge/40 mb-3">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-brand transition-all duration-500 ease-out"
          style={{ width: `${((currentStepIndex) / (STEP_KEYS.length - 1)) * 100}%` }}
        />
        {/* Step dots on the bar */}
        {STEP_LABELS.map((_, i) => {
          const isComplete = currentStepIndex > i;
          const isCurrent = currentStepIndex === i;
          return (
            <div
              key={i}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
              style={{ left: `${(i / (STEP_KEYS.length - 1)) * 100}%` }}
            >
              <div
                className={`
                  w-3 h-3 rounded-full border-2 transition-snappy
                  ${isComplete
                    ? 'bg-brand border-brand'
                    : isCurrent
                      ? 'bg-white border-brand shadow-sm'
                      : 'bg-canvas border-edge'}
                `}
              />
            </div>
          );
        })}
      </div>

      {/* Labels */}
      <div className="flex justify-between">
        {STEP_LABELS.map((label, i) => {
          const isCurrent = currentStepIndex === i;
          const isComplete = currentStepIndex > i;
          return (
            <span
              key={label}
              className={`text-xs font-medium transition-snappy ${
                isCurrent ? 'text-heading' : isComplete ? 'text-brand' : 'text-muted'
              }`}
              style={{
                width: `${100 / STEP_KEYS.length}%`,
                textAlign: i === 0 ? 'left' : i === STEP_KEYS.length - 1 ? 'right' : 'center',
              }}
            >
              {label}
            </span>
          );
        })}
      </div>
    </nav>
  );
}
