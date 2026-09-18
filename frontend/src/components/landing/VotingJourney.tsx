import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';

interface JourneyStep {
  number: string;
  labelKey: string;
  hintKey: string;
}

export const VotingJourney: React.FC = () => {
  const { t } = useLanguage();
  const [activeHover, setActiveHover] = useState<string | null>(null);

  const journeySteps: JourneyStep[] = [
    { number: '01', labelKey: 'journeyStep1', hintKey: 'journeyStep1Hint' },
    { number: '02', labelKey: 'journeyStep2', hintKey: 'journeyStep2Hint' },
    { number: '03', labelKey: 'journeyStep3', hintKey: 'journeyStep3Hint' },
    { number: '04', labelKey: 'journeyStep4', hintKey: 'journeyStep4Hint' },
    { number: '05', labelKey: 'journeyStep5', hintKey: 'journeyStep5Hint' },
    { number: '06', labelKey: 'journeyStep6', hintKey: 'journeyStep6Hint' },
    { number: '07', labelKey: 'journeyStep7', hintKey: 'journeyStep7Hint' }
  ];

  return (
    <div className="editorial-process-container">
      <div className="editorial-process-track" role="list">
        {journeySteps.map((step) => {
          const isHovered = activeHover === step.number;
          return (
            <div
              key={step.number}
              className="editorial-process-step"
              role="listitem"
              onMouseEnter={() => setActiveHover(step.number)}
              onMouseLeave={() => setActiveHover(null)}
              style={{
                borderTopColor: isHovered ? 'var(--text-primary)' : 'var(--border-subtle)'
              }}
            >
              <div
                className="step-big-number"
                style={{
                  color: isHovered ? 'var(--text-primary)' : 'var(--color-silver-slate)',
                  transition: 'color 0.2s ease'
                }}
              >
                {step.number}
              </div>
              <div className="step-short-label">
                {t(step.labelKey)}
              </div>
              <div className="step-short-hint">
                {t(step.hintKey)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};


