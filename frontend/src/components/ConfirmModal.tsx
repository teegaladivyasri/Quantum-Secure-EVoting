import React, { useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAudio } from '../context/AudioContext';
import { ShieldAlert, CheckCircle, XCircle, Volume2 } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  candidateName: string;
  party: string;
  constituency: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  candidateName,
  party,
  constituency,
  onConfirm,
  onCancel,
  loading
}) => {
  const { t, language } = useLanguage();
  const { speak } = useAudio();

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, onCancel]);

  if (!isOpen) return null;

  const handleReadDetails = () => {
    let text = '';
    if (language === 'te') {
      text = `మీరు అభ్యర్థి ${candidateName}, పార్టీ ${party}, నియోజకవర్గం ${constituency} కు ఓటు వేయబోతున్నారు. సమర్పించిన తర్వాత మీ ఓటును మార్చడం సాధ్యం కాదు. దయచేసి నిర్ధారించండి.`;
    } else if (language === 'hi') {
      text = `आप उम्मीदवार ${candidateName}, दल ${party}, निर्वाचन क्षेत्र ${constituency} के लिए अपना मत डालने जा रहे हैं। जमा करने के बाद आपके मत को बदला नहीं जा सकता। कृपया अपनी पसंद की पुष्टि करें।`;
    } else {
      text = `You are about to cast your vote for candidate ${candidateName}, party ${party}, constituency ${constituency}. Your vote cannot be changed after submission. Please confirm your choice.`;
    }
    speak(text);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1.5rem'
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      aria-describedby="modal-description"
    >
      <div
        className="glass-card"
        style={{
          maxWidth: '520px',
          width: '100%',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-lg)',
          borderRadius: 'var(--radius-lg)',
          position: 'relative'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                background: 'var(--bg-surface-elevated)',
                color: 'var(--text-primary)',
                padding: '0.6rem',
                borderRadius: '12px',
                border: '1px solid var(--border-subtle)'
              }}
              aria-hidden="true"
            >
              <ShieldAlert size={26} />
            </div>
            <div>
              <h2 id="modal-title" style={{ fontSize: '1.4rem', margin: 0 }}>
                {t('confirmModalTitle')}
              </h2>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {t('registeredConstituency')}: {constituency}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleReadDetails}
            className="btn btn-outline"
            style={{ minHeight: '40px', padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
            title={t('confirmDetailsAudio')}
            aria-label={t('confirmDetailsAudio')}
          >
            <Volume2 size={16} />
            <span>{t('readOutDetails')}</span>
          </button>
        </div>

        <div
          id="modal-description"
          style={{
            background: 'var(--bg-surface-elevated)',
            padding: '1.25rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            marginBottom: '1.5rem'
          }}
        >
          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
            {t('confirmModalMessage')}
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {candidateName}
          </div>
          <div style={{ fontSize: '1rem', color: 'var(--text-primary)', marginTop: '0.25rem' }}>
            {t('partyAffiliation')}: <strong>{party}</strong>
          </div>
          <div style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            {t('registeredConstituency')}: <strong>{constituency}</strong>
          </div>
        </div>

        <div
          style={{
            fontSize: '0.85rem',
            color: 'var(--text-muted)',
            marginBottom: '1.5rem',
            lineHeight: 1.4
          }}
        >
          {t('confirmModalNotice')}
        </div>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="btn btn-outline"
            style={{ flex: '1 1 140px', minHeight: '48px' }}
            aria-label={t('cancelBtn')}
          >
            <XCircle size={18} />
            <span>{t('cancelBtn')}</span>
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="btn btn-gold"
            style={{ flex: '1 1 200px', minHeight: '48px' }}
            aria-label={loading ? t('processingSecureVote') : t('confirmVoteBtn')}
          >
            {loading ? (
              <span role="status" aria-live="polite">
                {t('processingSecureVote')}
              </span>
            ) : (
              <>
                <CheckCircle size={18} />
                <span>{t('confirmVoteBtn')}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
