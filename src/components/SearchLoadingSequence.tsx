import { useState, useEffect } from 'react';
import { Check, Loader2 } from 'lucide-react';

const STEPS = [
  'Searching carrier network...',
  'Checking reliability history...',
  'Reviewing carrier reports...',
  'Calculating CDL Score...',
  'Generating profile...',
];

const STEP_DURATION_MS = 500;
const TOTAL_MIN_MS = 2500;

interface Props {
  active: boolean;
  onComplete?: () => void;
}

export function SearchLoadingSequence({ active, onComplete }: Props) {
  const [completedSteps, setCompletedSteps] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (!active) {
      setCompletedSteps(0);
      setCurrentStep(0);
      return;
    }

    const startTime = Date.now();
    let step = 0;

    const interval = setInterval(() => {
      step += 1;
      setCompletedSteps(step);
      setCurrentStep(Math.min(step, STEPS.length - 1));

      if (step >= STEPS.length) {
        clearInterval(interval);
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, TOTAL_MIN_MS - elapsed);
        setTimeout(() => onComplete?.(), remaining);
      }
    }, STEP_DURATION_MS);

    return () => clearInterval(interval);
  }, [active, onComplete]);

  if (!active) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-8 card-shadow animate-fade-in">
      <div className="max-w-md mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center">
            <Loader2 size={20} className="text-white animate-spin" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">Analyzing Driver Profile</h3>
            <p className="text-sm text-gray-500">Running comprehensive verification checks</p>
          </div>
        </div>

        <div className="space-y-4">
          {STEPS.map((label, i) => {
            const isDone = i < completedSteps;
            const isCurrent = i === currentStep && !isDone;
            const isPending = i > currentStep;

            return (
              <div
                key={label}
                className={`flex items-center gap-3 transition-all duration-300 ${
                  isPending ? 'opacity-30' : 'opacity-100'
                }`}
                style={{ transitionDelay: `${i * 50}ms` }}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                  isDone
                    ? 'bg-emerald-500 text-white'
                    : isCurrent
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-400'
                }`}>
                  {isDone ? (
                    <Check size={14} className="animate-check-pop" strokeWidth={3} />
                  ) : isCurrent ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                  )}
                </div>
                <span className={`text-sm font-medium transition-colors duration-300 ${
                  isDone ? 'text-emerald-700' : isCurrent ? 'text-gray-900' : 'text-gray-400'
                }`}>
                  {label}
                </span>
                {isDone && (
                  <Check size={14} className="ml-auto text-emerald-500 animate-check-pop" strokeWidth={3} />
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-8 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-gray-900 to-emerald-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${Math.min(100, (completedSteps / STEPS.length) * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
