import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useAudio } from '../../context/AudioContext';
import { api } from '../../services/api';
import type { VoterElectionInfoResponse, Candidate } from '../../services/api';
import {
  Vote,
  CheckCircle2,
  ShieldCheck,
  ArrowRight,
  Volume2,
  AlertCircle,
  Info,
  X,
  RotateCcw,
  Check
} from 'lucide-react';

import { 
  getLocalizedCandidateName, 
  getLocalizedCandidateParty, 
  getLocalizedConstituency, 
  getLocalizedElectionTitle,
  getLocalizedElectionDesc
} from '../../utils/localization';

export const VoterDashboard: React.FC = () => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { speak } = useAudio();
  const navigate = useNavigate();

  const [electionInfo, setElectionInfo] = useState<VoterElectionInfoResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [selectedDetailCandidate, setSelectedDetailCandidate] = useState<Candidate | null>(null);

  const fetchElectionData = () => {
    setLoading(true);
    setError('');
    api.getVoterElectionInfo()
      .then((res) => {
        setElectionInfo(res.data);
      })
      .catch((err) => {
        const status = err.response?.status;
        if (status === 401) {
          setError(t('sessionExpiredNotice'));
        } else if (status === 403) {
          setError(t('accessDeniedNotice'));
        } else if (status === 404) {
          setError(t('notEligibleDesc'));
        } else {
          setError(t('errorLoadingElection'));
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchElectionData();
  }, [t]);

  // Mask Voter ID: e.g. VTR-2026-00101 -> VTR-2026-••101
  const formatMaskedVoterId = (id?: string | null): string => {
    if (!id) return 'VTR-••••-•••••';
    const parts = id.split('-');
    if (parts.length === 3) {
      const last = parts[2];
      const maskedLast = last.length > 3 ? '••' + last.slice(-3) : '••' + last.slice(-2);
      return `${parts[0]}-${parts[1]}-${maskedLast}`;
    }
    return id.slice(0, 4) + '••••' + id.slice(-3);
  };

  // Spoken voice overview of election & voter status
  const handleReadStatus = () => {
    if (!electionInfo) return;
    const hasVoted = electionInfo.has_voted;
    const hasActive = !!electionInfo.election && electionInfo.election.is_active;
    const voterName = user?.full_name || user?.username || 'Voter';
    const constituency = getLocalizedConstituency(
      electionInfo.voter_constituency || user?.constituency || '',
      language,
      electionInfo.voter_constituency_info
    );
    const electionTitle = getLocalizedElectionTitle(
      electionInfo.election,
      language,
      language === 'te' ? 'ఎన్నికలు లేవు' : (language === 'hi' ? 'कोई चुनाव नहीं' : 'None')
    );

    let statusText = '';
    if (hasVoted) {
      statusText = language === 'te'
        ? 'మీ ఓటు ఇప్పటికే నమోదైంది.'
        : language === 'hi'
          ? 'आपका वोट पहले ही डाला जा चुका है।'
          : 'Your vote has already been recorded.';
    } else if (hasActive) {
      statusText = language === 'te'
        ? 'మీరు ఓటు వేయడానికి అర్హులు.'
        : language === 'hi'
          ? 'आप मतदान करने के पात्र हैं।'
          : 'You are eligible to vote.';
    } else {
      statusText = language === 'te'
        ? 'ప్రస్తుతం ఎటువంటి ఎన్నికలు చురుకుగా లేవు.'
        : language === 'hi'
          ? 'वर्तमान में कोई सक्रिय चुनाव नहीं है।'
          : 'No active election is currently running.';
    }

    const text = language === 'te'
      ? `స్వాగతం ${voterName}. మీ నియోజకవర్గం ${constituency}. ఎన్నికల పేరు: ${electionTitle}. ${statusText}`
      : language === 'hi'
        ? `स्वागत है ${voterName}. आपका निर्वाचन क्षेत्र ${constituency} है। चुनाव का नाम: ${electionTitle}। ${statusText}`
        : `Welcome ${voterName}. Registered constituency: ${constituency}. Election: ${electionTitle}. ${statusText}`;
    speak(text);
  };

  // Spoken voting instructions
  const handleReadInstructions = () => {
    const text = language === 'te'
      ? 'ఓటు వేయడానికి ముందు సూచనలు: 1. మీ నియోజకవర్గ అభ్యర్థులను పరిశీలించండి. 2. మీ ప్రాధాన్యత అభ్యర్థిని ఎంచుకోండి. 3. సమర్పించే ముందు నిర్ధారించండి. 4. సమర్పించిన తర్వాత మీ ఓటు మార్చడం సాధ్యం కాదు.'
      : language === 'hi'
        ? 'मतदान से पहले निर्देश: 1. अपने निर्वाचन क्षेत्र के उम्मीदवारों की समीक्षा करें। 2. अपने पसंदीदा उम्मीदवार का चयन करें। 3. जमा करने से पहले पुष्टि करें। 4. जमा करने के बाद वोट बदला नहीं जा सकता।'
        : 'Before you vote: 1. Review the eligible candidates in your constituency. 2. Select your preferred candidate. 3. Review your selection before submitting. 4. Once submitted, your vote cannot be changed.';
    speak(text);
  };

  // Loading Skeleton State
  if (loading) {
    return (
      <div style={{ maxWidth: '860px', margin: '2rem auto', padding: '0 1rem' }}>
        <div
          className="glass-card"
          style={{
            textAlign: 'center',
            padding: '4rem 2rem',
            border: '1px solid var(--border-glass)',
            boxShadow: 'var(--card-shadow)'
          }}
          role="status"
          aria-live="polite"
        >
          <div
            style={{
              width: '54px',
              height: '54px',
              borderRadius: '50%',
              border: '3px solid var(--color-soft-gold)',
              borderTopColor: 'transparent',
              margin: '0 auto 1.25rem',
              animation: 'spin 1s linear infinite'
            }}
          />
          <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>{t('loadingVoterInfo')}</h3>
        </div>
      </div>
    );
  }

  const hasActiveElection = !!electionInfo?.election && electionInfo.election.is_active;
  const eligibleCandidates = electionInfo?.eligible_candidates || [];
  const voterDisplayName = user?.full_name || user?.username || 'Verified Voter';
  const displayedConstituency = getLocalizedConstituency(
    electionInfo?.voter_constituency || user?.constituency || 'Ward-1',
    language,
    electionInfo?.voter_constituency_info
  );
  const displayedElectionTitle = getLocalizedElectionTitle(electionInfo?.election, language, t('noActiveElection'));
  const displayedElectionDesc = getLocalizedElectionDesc(electionInfo?.election, language, t('noActiveElectionDesc'));

  return (
    <div style={{ maxWidth: '860px', margin: '1.5rem auto 3rem', display: 'flex', flexDirection: 'column', gap: '1.75rem', padding: '0 1rem' }}>
      {/* Error Alert with Retry */}
      {error && (
        <div className="alert alert-error" role="alert" aria-live="assertive" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <AlertCircle size={18} aria-hidden="true" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchElectionData}
            className="btn btn-outline"
            style={{ minHeight: '36px', padding: '0.2rem 0.75rem', fontSize: '0.8rem' }}
          >
            <RotateCcw size={14} />
            <span>{t('retryLoadingBtn')}</span>
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* SECTION 1 — WELCOME & VOTER IDENTITY BANNER               */}
      {/* ========================================================= */}
      <div
        className="glass-card"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.25rem',
          border: '1px solid var(--border-glass)',
          padding: '1.75rem 2rem'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                background: 'rgba(16, 185, 129, 0.12)',
                color: '#10b981',
                padding: '0.25rem 0.65rem',
                borderRadius: '16px',
                fontSize: '0.8rem',
                fontWeight: 600,
                border: '1px solid rgba(16, 185, 129, 0.3)'
              }}
            >
              <CheckCircle2 size={14} />
              <span>{t('identityVerifiedBadge')}</span>
            </span>

            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              • {t('voterIdLabel')}: <strong style={{ color: 'var(--text-primary)', letterSpacing: '0.04em' }}>{formatMaskedVoterId(user?.voter_id)}</strong>
            </span>
          </div>

          <h2 style={{ fontSize: '1.65rem', margin: '0 0 0.35rem', color: 'var(--text-primary)' }}>
            {t('welcomeUser')}{voterDisplayName}
          </h2>

          <div style={{ fontSize: '0.95rem', color: 'var(--text-muted)' }}>
            {t('registeredConstituency')}: <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{displayedConstituency}</strong>
          </div>
        </div>

        <button
          type="button"
          onClick={handleReadStatus}
          className="btn btn-outline"
          style={{ minHeight: '44px', padding: '0.5rem 1rem', fontSize: '0.88rem' }}
          title={t('listenStatus')}
          aria-label={t('listenStatus')}
        >
          <Volume2 size={16} aria-hidden="true" />
          <span>{t('listenStatus')}</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* SECTION 2 — ACTIVE ELECTION CARD                         */}
      {/* ========================================================= */}
      <div
        className="glass-card"
        style={{
          border: `1.5px solid ${electionInfo?.has_voted ? 'var(--color-success)' : 'var(--border-subtle)'}`,
          boxShadow: 'var(--shadow-md)',
          padding: '2rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-surface-elevated)',
                color: electionInfo?.has_voted ? 'var(--color-success)' : 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: `1px solid ${electionInfo?.has_voted ? 'rgba(27, 135, 63, 0.4)' : 'var(--border-subtle)'}`
              }}
              aria-hidden="true"
            >
              {electionInfo?.has_voted ? <CheckCircle2 size={28} /> : <Vote size={28} />}
            </div>

            <div>
              <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontWeight: 600 }}>
                {t('activeElectionBadge')}
              </div>
              <h3 style={{ margin: '0.15rem 0', fontSize: '1.45rem', color: 'var(--text-primary)' }}>
                {displayedElectionTitle}
              </h3>
              <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                {displayedElectionDesc}
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.35rem 0.8rem',
              borderRadius: 'var(--radius-pill)',
              fontSize: '0.82rem',
              fontWeight: 600,
              background: 'var(--bg-surface-elevated)',
              color: hasActiveElection ? 'var(--text-primary)' : 'var(--text-muted)',
              border: '1px solid var(--border-subtle)'
            }}
          >
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: hasActiveElection ? 'var(--color-success)' : 'var(--text-muted)' }} />
            <span>{hasActiveElection ? t('electionStatusActive') : t('electionInactiveStatus')}</span>
          </div>
        </div>

        {/* Voting Status / One-Vote Enforced Notice */}
        <div
          style={{
            background: 'var(--bg-surface-elevated)',
            padding: '1.25rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            margin: '1.25rem 0'
          }}
        >
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t('votingEligibility')}
          </div>
          <div
            style={{
              fontSize: '1.2rem',
              fontWeight: 700,
              color: electionInfo?.has_voted ? 'var(--color-success)' : hasActiveElection ? 'var(--text-primary)' : 'var(--text-muted)',
              marginTop: '0.25rem'
            }}
          >
            {electionInfo?.has_voted
              ? t('alreadyVotedStatus')
              : hasActiveElection
                ? t('eligibleToVote')
                : t('electionInactiveStatus')}
          </div>

          {electionInfo?.has_voted && (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <ShieldCheck size={16} color="var(--color-success)" />
              <span>{t('voteAlreadySubmittedDesc')}</span>
            </div>
          )}
        </div>

        {/* Primary Action Button */}
        {!electionInfo?.has_voted ? (
          <div>
            {hasActiveElection && eligibleCandidates.length > 0 ? (
              <button
                type="button"
                onClick={() => navigate('/voter/ballot')}
                className="btn btn-gold"
                style={{ width: '100%', fontSize: '1.1rem', minHeight: '52px', justifyContent: 'center' }}
                aria-label={t('startVotingBtn')}
              >
                <span>{t('startVotingBtn')}</span>
                <ArrowRight size={20} aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                disabled
                className="btn btn-outline"
                style={{ width: '100%', fontSize: '1.05rem', minHeight: '52px', opacity: 0.6, cursor: 'not-allowed', justifyContent: 'center' }}
              >
                <span>{hasActiveElection ? t('noCandidatesAvailable') : t('votingClosed')}</span>
              </button>
            )}
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              color: '#10b981',
              fontWeight: 600,
              fontSize: '0.95rem',
              padding: '0.5rem 0'
            }}
            role="status"
          >
            <ShieldCheck size={20} aria-hidden="true" />
            <span>{t('singleVoteEnforcedNotice')}</span>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* SECTION 3 — VOTING INSTRUCTIONS ("BEFORE YOU VOTE")       */}
      {/* ========================================================= */}
      <div
        className="glass-card"
        style={{
          border: '1px solid var(--border-glass)',
          padding: '1.75rem 2rem'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center' }}>
              <Info size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.25rem' }}>{t('beforeYouVoteTitle')}</h3>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{t('beforeYouVoteSubtitle')}</div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleReadInstructions}
            className="btn btn-outline"
            style={{ minHeight: '40px', padding: '0.35rem 0.85rem', fontSize: '0.82rem' }}
            title={t('hearInstructionsBtn')}
            aria-label={t('hearInstructionsBtn')}
          >
            <Volume2 size={15} />
            <span>{t('hearInstructionsBtn')}</span>
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginTop: '1.25rem' }}>
          <div style={{ background: 'var(--bg-surface-elevated)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.88rem', marginBottom: '0.25rem' }}>
              Step 1
            </div>
            <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              {t('votingInstruction1')}
            </div>
          </div>

          <div style={{ background: 'var(--bg-surface-elevated)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.88rem', marginBottom: '0.25rem' }}>
              Step 2
            </div>
            <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              {t('votingInstruction2')}
            </div>
          </div>

          <div style={{ background: 'var(--bg-surface-elevated)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.88rem', marginBottom: '0.25rem' }}>
              Step 3
            </div>
            <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              {t('votingInstruction3')}
            </div>
          </div>

          <div style={{ background: 'var(--bg-surface-elevated)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.88rem', marginBottom: '0.25rem' }}>
              Step 4
            </div>
            <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              {t('votingInstruction4')}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* SECTION 4 — CANDIDATE DISPLAY FOR CONSTITUENCY            */}
      {/* ========================================================= */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.35rem' }}>{t('eligibleCandidatesCount')}</h3>
            <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              {eligibleCandidates.length} {language === 'te' ? 'అభ్యర్థులు నమోదయ్యారు' : language === 'hi' ? 'उम्मीदवार पंजीकृत हैं' : 'registered nominees in'} <strong style={{ color: 'var(--text-gold)' }}>{displayedConstituency}</strong>
            </div>
          </div>

          {!electionInfo?.has_voted && hasActiveElection && eligibleCandidates.length > 0 && (
            <button
              type="button"
              onClick={() => navigate('/voter/ballot')}
              className="btn btn-outline"
              style={{ fontSize: '0.88rem', padding: '0.45rem 1rem' }}
            >
              <span>{t('proceedToBallot')}</span>
              <ArrowRight size={16} />
            </button>
          )}
        </div>

        {/* Candidate Cards Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.25rem' }}>
          {eligibleCandidates.map((cand) => {
            const candName = getLocalizedCandidateName(cand, language);
            const candParty = getLocalizedCandidateParty(cand, language);
            const candConst = getLocalizedConstituency(cand.constituency, language, electionInfo?.voter_constituency_info);
            return (
              <div
                key={cand.id}
                className="glass-card"
                style={{
                  border: '1px solid var(--border-glass)',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  transition: 'transform 0.2s ease, border-color 0.2s ease',
                  position: 'relative'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '0.85rem' }}>
                    <div
                      style={{
                        width: '46px',
                        height: '46px',
                        borderRadius: '50%',
                        background: 'var(--bg-surface-elevated)',
                        color: 'var(--text-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '1.2rem',
                        border: '1px solid var(--border-subtle)'
                      }}
                    >
                      {candName.charAt(0)}
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary)' }}>{candName}</h4>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {t('candidateOfficialNominee')}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', margin: '0.5rem 0 1rem' }}>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                      {candParty}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {t('registeredConstituency')}: {candConst}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                  <button
                    type="button"
                    onClick={() => setSelectedDetailCandidate(cand)}
                    className="btn btn-outline"
                    style={{ flex: 1, minHeight: '40px', fontSize: '0.82rem', padding: '0.3rem 0.5rem', justifyContent: 'center' }}
                    aria-label={`${t('candidateCardDetailsBtn')}: ${candName}`}
                  >
                    {t('candidateCardDetailsBtn')}
                  </button>

                  {!electionInfo?.has_voted && hasActiveElection && (
                    <button
                      type="button"
                      onClick={() => navigate('/voter/ballot')}
                      className="btn btn-gold"
                      style={{ minHeight: '40px', fontSize: '0.82rem', padding: '0.3rem 0.75rem', justifyContent: 'center' }}
                      title={t('startVotingBtn')}
                    >
                      <span>{t('startVotingBtn')}</span>
                      <ArrowRight size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {eligibleCandidates.length === 0 && (
            <div className="glass-card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem 1.5rem' }}>
              <AlertCircle size={36} color="var(--text-muted)" style={{ margin: '0 auto 0.75rem' }} />
              <h4>{t('noCandidatesAvailable')}</h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '420px', margin: '0.5rem auto 0' }}>
                {t('noCandidatesInConstituency')} ({displayedConstituency}).
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* CANDIDATE DETAILS MODAL (Available Information Only)      */}
      {/* ========================================================= */}
      {selectedDetailCandidate && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(18, 24, 38, 0.75)',
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
        >
          <div
            className="glass-card"
            style={{
              maxWidth: '480px',
              width: '100%',
              border: '1px solid var(--border-subtle)',
              boxShadow: 'var(--shadow-lg)',
              borderRadius: 'var(--radius-lg)',
              position: 'relative',
              padding: '2rem'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div
                  style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: '50%',
                    background: 'var(--bg-surface-elevated)',
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '1.35rem',
                    border: '1px solid var(--border-subtle)'
                  }}
                >
                  {getLocalizedCandidateName(selectedDetailCandidate, language).charAt(0)}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.35rem', color: 'var(--text-primary)' }}>
                    {getLocalizedCandidateName(selectedDetailCandidate, language)}
                  </h3>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    {getLocalizedCandidateParty(selectedDetailCandidate, language)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedDetailCandidate(null)}
                className="btn btn-outline"
                style={{ padding: '0.35rem', minHeight: 'auto', borderRadius: '50%' }}
                aria-label={t('closeDetailsBtn')}
              >
                <X size={18} />
              </button>
            </div>

            <div
              style={{
                background: 'var(--bg-surface-elevated)',
                padding: '1.25rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                marginBottom: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem'
              }}
            >
              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {t('registeredConstituency')}
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {getLocalizedConstituency(selectedDetailCandidate.constituency, language, electionInfo?.voter_constituency_info)}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {t('activeElectionBadge')}
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {displayedElectionTitle}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Status
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Check size={16} />
                  <span>{t('candidateOfficialNominee')}</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setSelectedDetailCandidate(null)}
                className="btn btn-outline"
                style={{ minHeight: '44px', padding: '0.5rem 1.25rem' }}
              >
                {t('closeDetailsBtn')}
              </button>

              {!electionInfo?.has_voted && hasActiveElection && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDetailCandidate(null);
                    navigate('/voter/ballot');
                  }}
                  className="btn btn-gold"
                  style={{ minHeight: '44px', padding: '0.5rem 1.5rem' }}
                >
                  <span>{t('startVotingBtn')}</span>
                  <ArrowRight size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
