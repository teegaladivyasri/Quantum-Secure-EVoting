import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { useAudio } from '../../context/AudioContext';
import { api } from '../../services/api';
import type { VoterElectionInfoResponse, Candidate } from '../../services/api';
import { ConfirmModal } from '../../components/ConfirmModal';
import { Volume2, Shield, AlertCircle, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react';

import { 
  getLocalizedCandidateName, 
  getLocalizedCandidateParty, 
  getLocalizedConstituency, 
  getLocalizedElectionTitle 
} from '../../utils/localization';

export const BallotPage: React.FC = () => {
  const { t, language } = useLanguage();
  const { speak } = useAudio();
  const navigate = useNavigate();

  const [electionInfo, setElectionInfo] = useState<VoterElectionInfoResponse | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    api.getVoterElectionInfo()
      .then((res) => {
        setElectionInfo(res.data);
        if (res.data.has_voted) {
          navigate('/voter');
        }
      })
      .catch((err) => setError(err.response?.data?.message || t('generalVoteError')))
      .finally(() => setLoading(false));
  }, [navigate, t]);

  const candidates: Candidate[] = electionInfo?.eligible_candidates || [];
  const selectedCandidate = candidates.find((c) => c.id === selectedCandidateId);

  const handleCandidateSpeech = (cand: Candidate, e: React.MouseEvent) => {
    e.stopPropagation();
    const localizedName = getLocalizedCandidateName(cand, language);
    const localizedParty = getLocalizedCandidateParty(cand, language);
    const localizedConst = getLocalizedConstituency(cand.constituency, language, electionInfo?.voter_constituency_info);
    let text = '';
    if (language === 'te') {
      text = `అభ్యర్థి: ${localizedName}. పార్టీ: ${localizedParty}. నియోజకవర్గం: ${localizedConst}.`;
    } else if (language === 'hi') {
      text = `उम्मीदवार: ${localizedName}। दल: ${localizedParty}। निर्वाचन क्षेत्र: ${localizedConst}।`;
    } else {
      text = `Candidate: ${localizedName}. Party: ${localizedParty}. Constituency: ${localizedConst}.`;
    }
    speak(text);
  };

  const handleOpenConfirm = () => {
    if (!selectedCandidate) return;
    setIsModalOpen(true);
    const localizedName = getLocalizedCandidateName(selectedCandidate, language);
    let text = '';
    if (language === 'te') {
      text = `మీరు ${localizedName} కు ఓటు వేయబోతున్నారు. దయచేసి నిర్ధారించండి.`;
    } else if (language === 'hi') {
      text = `आप ${localizedName} को वोट देने जा रहे हैं। कृपया पुष्टि करें।`;
    } else {
      text = `You are about to cast your vote for ${localizedName}. Please confirm your choice.`;
    }
    speak(text);
  };

  const handleConfirmVote = async () => {
    if (!electionInfo?.election?.id || !selectedCandidateId || submitting) return;

    setError('');
    setSubmitting(true);

    try {
      const res = await api.castVote(electionInfo.election.id, selectedCandidateId);
      // Navigate to success screen with quantum telemetry; candidate choice is NOT retained
      navigate('/voter/success', { state: { telemetry: res.data.telemetry, success: true } });
    } catch (err: any) {
      const status = err.response?.status;
      const backendMsg = (err.response?.data?.message || '').toLowerCase();
      let displayMsg = '';

      if (status === 401) {
        displayMsg = t('sessionExpiredError');
      } else if (status === 403) {
        displayMsg = t('unauthorizedError');
      } else if (status === 409) {
        displayMsg = t('duplicateVoteError');
      } else if (status === 400 && (backendMsg.includes('disturbance') || backendMsg.includes('qber'))) {
        displayMsg = t('qberDisturbanceError');
      } else if (status === 400) {
        displayMsg = err.response?.data?.message || t('generalVoteError');
      } else if (status === 500) {
        displayMsg = t('serverVoteError');
      } else {
        displayMsg = err.response?.data?.message || t('generalVoteError');
      }

      setError(displayMsg);
      setIsModalOpen(false);
      speak(displayMsg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="glass-card" style={{ textAlign: 'center', padding: '3rem' }} role="status" aria-live="polite">
        <span>{t('loadingBallot')}</span>
      </div>
    );
  }

  const electionTitle = getLocalizedElectionTitle(electionInfo?.election, language);
  const localizedVoterConstituency = getLocalizedConstituency(
    electionInfo?.voter_constituency,
    language,
    electionInfo?.voter_constituency_info
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <button
            type="button"
            onClick={() => navigate('/voter')}
            className="btn btn-outline"
            style={{ minHeight: '44px', padding: '0.4rem 1rem', marginBottom: '0.5rem' }}
            aria-label={t('backToDashboard')}
          >
            <ArrowLeft size={16} aria-hidden="true" />
            <span>{t('backToDashboard')}</span>
          </button>
          <h2>{t('voterDashboardTitle')}</h2>
          <div style={{ fontSize: '0.95rem', color: 'var(--text-muted)' }}>
            {electionTitle} • {t('registeredConstituency')}: <strong style={{ color: 'var(--text-primary)' }}>{localizedVoterConstituency}</strong>
          </div>
        </div>

        <div className="gold-badge" aria-label={t('securePortalAria')}>
          <Shield size={16} aria-hidden="true" />
          <span>{t('secureVotingPortal')}</span>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" role="alert" aria-live="assertive">
          <AlertCircle size={20} aria-hidden="true" />
          <div>
            <div style={{ fontWeight: 700 }}>{t('votingNotice')}</div>
            <div>{error}</div>
          </div>
        </div>
      )}

      {/* EVM-Inspired Digital Balloting Unit Frame */}
      <div
        style={{
          background: 'var(--bg-surface)',
          borderRadius: 'var(--radius-md)',
          border: '2px solid var(--border-subtle)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Balloting Unit Top Bezel */}
        <div
          style={{
            background: 'var(--bg-surface-elevated)',
            padding: '1rem 1.5rem',
            borderBottom: '2px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem'
          }}
        >
          <div>
            <div style={{ fontSize: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-soft-gold)', fontWeight: 700 }}>
              {t('digitalBallotingUnit')}
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {electionTitle}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {t('districtLabel')}: <strong>{localizedVoterConstituency}</strong> • {electionInfo?.election?.state || 'Example State'}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: '#10b981',
                boxShadow: '0 0 8px #10b981',
                display: 'inline-block'
              }}
            ></span>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.05em', color: '#10b981' }}>
              {t('unitReady')}
            </span>
          </div>
        </div>

        {/* Instruction sub-banner */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.02)',
            padding: '0.75rem 1.5rem',
            borderBottom: '1px solid var(--border-subtle)',
            fontSize: '0.85rem',
            color: 'var(--text-secondary)'
          }}
        >
          {t('selectCandidatePrompt')}
        </div>

        {/* Balloting Unit Rows */}
        <div
          role="radiogroup"
          aria-label={t('selectCandidatePrompt')}
          style={{ display: 'flex', flexDirection: 'column' }}
        >
          {candidates.map((cand, index) => {
            const isSelected = selectedCandidateId === cand.id;
            const candName = getLocalizedCandidateName(cand, language);
            const candParty = getLocalizedCandidateParty(cand, language);
            const serialNumber = cand.is_nota
              ? t('notaBadge')
              : (cand.ballot_position < 10 ? `0${cand.ballot_position}` : `${cand.ballot_position || index + 1}`);

            return (
              <div
                key={cand.id}
                onClick={() => setSelectedCandidateId(cand.id)}
                role="radio"
                aria-checked={isSelected}
                aria-label={`${serialNumber}. ${candName}, ${candParty}`}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    setSelectedCandidateId(cand.id);
                  }
                }}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '70px 1fr auto auto',
                  alignItems: 'center',
                  padding: '1.1rem 1.5rem',
                  gap: '1.25rem',
                  borderBottom: index < candidates.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  background: isSelected 
                    ? 'rgba(255, 255, 255, 0.06)' 
                    : cand.is_nota 
                    ? 'rgba(0, 0, 0, 0.2)' 
                    : 'transparent',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease'
                }}
              >
                {/* Column 1: S.No */}
                <div
                  style={{
                    fontSize: '1.15rem',
                    fontWeight: 800,
                    fontFamily: 'monospace',
                    color: isSelected ? 'var(--color-soft-gold)' : 'var(--text-muted)'
                  }}
                  aria-hidden="true"
                >
                  {serialNumber}
                </div>

                {/* Column 2: Candidate & Party */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {candName}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: cand.is_nota ? 'var(--text-muted)' : 'var(--text-secondary)' }}>
                    {candParty}
                  </div>
                </div>

                {/* Column 3: Audio button */}
                <div>
                  <button
                    type="button"
                    onClick={(e) => handleCandidateSpeech(cand, e)}
                    className="btn btn-outline"
                    style={{
                      minHeight: '36px',
                      padding: '0.3rem 0.65rem',
                      fontSize: '0.75rem'
                    }}
                    title={`${t('hearCandidateDetails')}: ${candName}`}
                    aria-label={`${t('hearCandidateDetails')}: ${candName}`}
                  >
                    <Volume2 size={14} aria-hidden="true" />
                    <span>{t('readOutDetails')}</span>
                  </button>
                </div>

                {/* Column 4: EVM-Inspired Button + Indicator Lamp */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  {/* Indicator Lamp LED */}
                  <span
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      background: isSelected ? '#ef4444' : '#27272a',
                      boxShadow: isSelected ? '0 0 10px #ef4444' : 'none',
                      border: '1px solid #3f3f46',
                      transition: 'all 0.15s ease'
                    }}
                    title={isSelected ? t('selectedAria') : t('unselectedAria')}
                    aria-label={isSelected ? t('selectedAria') : t('unselectedAria')}
                  ></span>

                  {/* EVM-Style Blue Selector Button */}
                  <div
                    style={{
                      width: '56px',
                      height: '38px',
                      borderRadius: '4px',
                      background: isSelected 
                        ? 'linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%)' 
                        : 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
                      border: isSelected ? '2px solid #60a5fa' : '1px solid #334155',
                      boxShadow: isSelected 
                        ? 'inset 0 1px 0 rgba(255,255,255,0.3), 0 0 12px rgba(59, 130, 246, 0.5)' 
                        : 'inset 0 1px 0 rgba(255,255,255,0.1), 0 2px 4px rgba(0,0,0,0.5)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: isSelected ? '#ffffff' : '#94a3b8'
                    }}
                    aria-hidden="true"
                  >
                    {isSelected && <CheckCircle2 size={18} color="#ffffff" />}
                  </div>
                </div>
              </div>
            );
          })}

          {candidates.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              <AlertCircle size={32} style={{ margin: '0 auto 0.75rem' }} />
              <h3>{t('noCandidatesAvailable')}</h3>
              <p>{t('noCandidatesInConstituency')} ({localizedVoterConstituency}).</p>
            </div>
          )}
        </div>
      </div>

      {/* Review & Proceed Button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
        <button
          type="button"
          onClick={handleOpenConfirm}
          disabled={!selectedCandidateId || submitting}
          className="btn btn-gold"
          style={{
            fontSize: '1.15rem',
            padding: '0.9rem 2.5rem',
            minHeight: '52px',
            opacity: !selectedCandidateId ? 0.4 : 1
          }}
          aria-label={t('reviewAndConfirm')}
        >
          <span>{t('reviewAndConfirm')}</span>
          <ArrowRight size={20} aria-hidden="true" />
        </button>
      </div>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={isModalOpen}
        candidateName={selectedCandidate ? getLocalizedCandidateName(selectedCandidate, language) : ''}
        party={selectedCandidate ? getLocalizedCandidateParty(selectedCandidate, language) : ''}
        constituency={getLocalizedConstituency(selectedCandidate?.constituency, language, electionInfo?.voter_constituency_info)}
        onConfirm={handleConfirmVote}
        onCancel={() => setIsModalOpen(false)}
        loading={submitting}
      />
    </div>
  );
};
