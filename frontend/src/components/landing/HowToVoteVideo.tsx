import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useAudio } from '../../context/AudioContext';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  ChevronRight, 
  ChevronLeft, 
  CheckCircle2, 
  LogIn, 
  ShieldCheck, 
  Vote, 
  UserCheck, 
  FileCheck2, 
  Send,
  Volume2
} from 'lucide-react';

interface StepDetail {
  number: number;
  titleKey: string;
  descKey: string;
  icon: React.ReactNode;
  uiBadge: string;
  uiHighlight: string;
}

export const HowToVoteVideo: React.FC = () => {
  const { t } = useLanguage();
  const { speak } = useAudio();
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  const steps: StepDetail[] = [
    {
      number: 1,
      titleKey: 'workflowStep1Title',
      descKey: 'workflowStep1Desc',
      icon: <LogIn size={28} />,
      uiBadge: 'Voter Identification',
      uiHighlight: 'Enter Registered Voter ID to Begin Session'
    },
    {
      number: 2,
      titleKey: 'workflowStep2Title',
      descKey: 'workflowStep2Desc',
      icon: <ShieldCheck size={28} />,
      uiBadge: 'OTP Verification',
      uiHighlight: 'Confirm access using the registered verification step'
    },
    {
      number: 3,
      titleKey: 'workflowStep3Title',
      descKey: 'workflowStep3Desc',
      icon: <UserCheck size={28} />,
      uiBadge: 'Identity Verification',
      uiHighlight: 'Complete Prototype Identity Verification'
    },
    {
      number: 4,
      titleKey: 'workflowStep4Title',
      descKey: 'workflowStep4Desc',
      icon: <Vote size={28} />,
      uiBadge: 'Active Civic Election',
      uiHighlight: 'Assigned Constituency & Official Ballot'
    },
    {
      number: 5,
      titleKey: 'workflowStep5Title',
      descKey: 'workflowStep5Desc',
      icon: <FileCheck2 size={28} />,
      uiBadge: 'Candidate Selection',
      uiHighlight: 'Select One Eligible Candidate'
    },
    {
      number: 6,
      titleKey: 'workflowStep6Title',
      descKey: 'workflowStep6Desc',
      icon: <Send size={28} />,
      uiBadge: 'Review & Confirmation',
      uiHighlight: 'Carefully Review Candidate Selection'
    },
    {
      number: 7,
      titleKey: 'workflowStep7Title',
      descKey: 'workflowStep7Desc',
      icon: <CheckCircle2 size={28} />,
      uiBadge: 'Protected Submission',
      uiHighlight: 'Ballot Processed with Separate Participation Record'
    }
  ];

  // Auto-advance walkthrough when playing
  useEffect(() => {
    let timer: any;
    if (isPlaying) {
      timer = setInterval(() => {
        setCurrentStep((prev) => {
          if (prev >= steps.length - 1) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 1;
        });
      }, 4000);
    }
    return () => clearInterval(timer);
  }, [isPlaying, steps.length]);

  const activeStep = steps[currentStep];

  const handleTogglePlay = () => {
    setIsPlaying((prev) => !prev);
  };

  const handleNext = () => {
    setIsPlaying(false);
    setCurrentStep((prev) => (prev < steps.length - 1 ? prev + 1 : 0));
  };

  const handlePrev = () => {
    setIsPlaying(false);
    setCurrentStep((prev) => (prev > 0 ? prev - 1 : steps.length - 1));
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentStep(0);
  };

  const handleSelectStep = (idx: number) => {
    setIsPlaying(false);
    setCurrentStep(idx);
  };

  const handleSpeakCurrentStep = () => {
    const text = `${t(activeStep.titleKey)}. ${t(activeStep.descKey)}`;
    speak(text);
  };

  return (
    <div style={{ margin: '1rem 0' }}>
      {/* Video / Simulator Screen Container */}
      <div
        style={{
          position: 'relative',
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          minHeight: '340px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '2.25rem',
          color: 'var(--text-primary)',
          boxShadow: 'var(--shadow-sm)'
        }}
        role="region"
        aria-label={t('interactiveTutorial')}
      >
        {/* Screen Header Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem' }}>
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: isPlaying ? 'var(--color-success)' : 'var(--color-silver-slate)',
                boxShadow: isPlaying ? '0 0 8px var(--color-success)' : 'none'
              }}
              aria-hidden="true"
            />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600, letterSpacing: '0.04em' }}>
              {t('stepOf')} {activeStep.number} / {steps.length} • {activeStep.uiBadge}
            </span>
          </div>

          <button
            type="button"
            onClick={handleSpeakCurrentStep}
            className="btn btn-outline"
            style={{
              minHeight: '36px',
              padding: '0.3rem 0.75rem',
              fontSize: '0.8rem',
              color: 'var(--text-primary)',
              borderColor: 'var(--border-subtle)'
            }}
            title={t('readOutDetails')}
            aria-label={t('readOutDetails')}
          >
            <Volume2 size={16} aria-hidden="true" />
            <span>{t('readOutDetails')}</span>
          </button>
        </div>

        {/* Center Stage: Interactive Step Demonstration */}
        <div style={{ margin: '2rem 0', textAlign: 'center' }}>
          <div
            style={{
              width: '68px',
              height: '68px',
              borderRadius: '50%',
              background: 'var(--bg-surface)',
              border: '1.5px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem',
              boxShadow: 'var(--shadow-sm)'
            }}
            aria-hidden="true"
          >
            {activeStep.icon}
          </div>

          <h3 style={{ fontSize: '1.6rem', color: 'var(--text-primary)', marginBottom: '0.6rem' }}>
            {t(activeStep.titleKey)}
          </h3>

          <p style={{ maxWidth: '620px', margin: '0 auto', fontSize: '1.05rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {t(activeStep.descKey)}
          </p>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              marginTop: '1.25rem',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              padding: '0.4rem 0.9rem',
              borderRadius: 'var(--radius-pill)',
              fontSize: '0.82rem',
              color: 'var(--text-primary)'
            }}
          >
            <CheckCircle2 size={14} color="var(--color-success)" />
            <span>{activeStep.uiHighlight}</span>
          </div>
        </div>

        {/* Playback Controls & Progress Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            borderTop: '1px solid var(--border-subtle)',
            paddingTop: '1.25rem'
          }}
        >
          {/* Step Selector Pills */}
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            {steps.map((s, idx) => (
              <button
                key={s.number}
                type="button"
                onClick={() => handleSelectStep(idx)}
                style={{
                  width: idx === currentStep ? '28px' : '10px',
                  height: '10px',
                  borderRadius: '5px',
                  background: idx === currentStep ? 'var(--btn-primary-bg)' : 'var(--border-subtle)',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.25s ease'
                }}
                title={`Go to step ${s.number}`}
                aria-label={`Go to step ${s.number}`}
              />
            ))}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handlePrev}
              className="btn btn-outline"
              style={{
                minHeight: '40px',
                padding: '0.4rem 0.8rem',
                color: 'var(--text-primary)',
                borderColor: 'var(--border-subtle)'
              }}
              aria-label={t('prevStep')}
            >
              <ChevronLeft size={18} aria-hidden="true" />
              <span>{t('prevStep')}</span>
            </button>

            <button
              type="button"
              onClick={handleTogglePlay}
              className="btn btn-gold"
              style={{ minHeight: '40px', padding: '0.4rem 1.1rem' }}
              aria-label={isPlaying ? 'Pause Guide' : 'Play Interactive Walkthrough'}
            >
              {isPlaying ? <Pause size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}
              <span>{isPlaying ? 'Pause' : 'Play Walkthrough'}</span>
            </button>

            <button
              type="button"
              onClick={handleNext}
              className="btn btn-outline"
              style={{
                minHeight: '40px',
                padding: '0.4rem 0.8rem',
                color: 'var(--text-primary)',
                borderColor: 'var(--border-subtle)'
              }}
              aria-label={t('nextStep')}
            >
              <span>{t('nextStep')}</span>
              <ChevronRight size={18} aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="btn btn-outline"
              style={{
                minHeight: '40px',
                padding: '0.4rem 0.6rem',
                color: 'var(--text-primary)',
                borderColor: 'var(--border-subtle)'
              }}
              title={t('resetWalkthrough')}
              aria-label={t('resetWalkthrough')}
            >
              <RotateCcw size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* Video Source Extensibility Note */}
      <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        {t('videoSimNotice')}
      </div>
    </div>
  );
};
