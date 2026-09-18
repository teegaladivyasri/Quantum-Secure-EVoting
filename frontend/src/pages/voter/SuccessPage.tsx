import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { useAudio } from '../../context/AudioContext';
import { CheckCircle2, ArrowRight, EyeOff } from 'lucide-react';

export const SuccessPage: React.FC = () => {
  const { t } = useLanguage();
  const { speak } = useAudio();
  const navigate = useNavigate();

  useEffect(() => {
    speak(t('voteSuccessSpoken'));
  }, [speak, t]);

  return (
    <div
      style={{ maxWidth: '650px', margin: '2rem auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}
      role="status"
      aria-live="polite"
    >
      <div
        className="glass-card"
        style={{
          textAlign: 'center',
          padding: '3.5rem 2rem',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-lg)'
        }}
      >
        <div
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--color-success)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1.5rem',
            boxShadow: 'var(--shadow-sm)'
          }}
          aria-hidden="true"
        >
          <CheckCircle2 size={44} />
        </div>

        <h1 style={{ fontSize: '2rem', marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
          {t('voteSuccessTitle')}
        </h1>

        <p style={{ fontSize: '1.15rem', color: 'var(--color-success)', fontWeight: 600, margin: '0 auto 0.75rem' }}>
          {t('voteSuccessMessage')}
        </p>

        <p style={{ fontSize: '1.05rem', color: 'var(--text-secondary)', maxWidth: '520px', margin: '0 auto 1.75rem' }}>
          {t('thankYouForParticipating')}
        </p>

        {/* Privacy Note */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'var(--bg-surface-elevated)',
            padding: '0.65rem 1.25rem',
            borderRadius: 'var(--radius-pill)',
            fontSize: '0.85rem',
            color: 'var(--text-muted)',
            marginBottom: '2.5rem',
            border: '1px solid var(--border-subtle)'
          }}
        >
          <EyeOff size={16} aria-hidden="true" />
          <span>{t('candidateSelectionClearedNotice')}</span>
        </div>

        <div>
          <button
            type="button"
            onClick={() => navigate('/voter')}
            className="btn btn-gold"
            style={{ fontSize: '1.05rem', padding: '0.85rem 2.2rem', minHeight: '48px' }}
            aria-label={t('returnToDashboard')}
          >
            <span>{t('returnToDashboard')}</span>
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
};
