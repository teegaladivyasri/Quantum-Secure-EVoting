import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useAudio } from '../context/AudioContext';
import { api } from '../services/api';
import { HowToVoteVideo } from '../components/landing/HowToVoteVideo';
import { VotingJourney } from '../components/landing/VotingJourney';
import { 
  ShieldCheck, 
  LogIn, 
  HelpCircle, 
  ArrowRight, 
  Activity,
  Vote,
  Sparkles,
  Users,
  CheckCircle2,
  FileCheck2
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const { t } = useLanguage();
  const { speak } = useAudio();
  const [healthStatus, setHealthStatus] = useState<{ status: string; qiskit: string } | null>(null);

  useEffect(() => {
    api.getHealth()
      .then(res => setHealthStatus({ status: res.data.status, qiskit: res.data.quantum_simulation }))
      .catch(() => setHealthStatus({ status: 'OFFLINE', qiskit: 'UNAVAILABLE' }));
  }, []);

  const handleReadIntroduction = () => {
    speak(t('landingSpokenOverview'));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5rem', paddingBottom: '3rem' }}>
      {/* =========================================================================
          HERO — EDITORIAL OPENING (No Outer Card, Typography-Dominant)
          ========================================================================= */}
      <section className="editorial-hero-wrapper fade-in-up">
        {/* Left: Monumental Typography & Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          {/* Small Eyebrow Label */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.8rem',
            fontWeight: 800,
            letterSpacing: '0.1em',
            color: 'var(--color-silver-slate)',
            marginBottom: '1.5rem',
            textTransform: 'uppercase'
          }}>
            <Sparkles size={13} aria-hidden="true" />
            <span>{t('heroEyebrow')}</span>
          </div>

          {/* Large Editorial Display Headline */}
          <h1 className="hero-large-headline">
            {t('heroTitle')}
          </h1>

          {/* Supporting Text */}
          <p
            style={{
              fontSize: '1.12rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.7,
              maxWidth: '560px',
              marginBottom: '2.25rem'
            }}
          >
            {t('heroSubtitle')}
          </p>

          {/* Action CTAs */}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <Link
              to="/login"
              className="btn btn-gold"
              style={{ fontSize: '0.98rem', padding: '0.9rem 2.25rem', minHeight: '48px', letterSpacing: '0.04em' }}
              aria-label={t('heroPrimaryCta')}
            >
              <LogIn size={18} aria-hidden="true" />
              <span>{t('heroPrimaryCta')}</span>
            </Link>

            <a
              href="#how-it-works"
              className="btn btn-outline"
              style={{ fontSize: '0.98rem', padding: '0.9rem 1.75rem', minHeight: '48px', letterSpacing: '0.03em' }}
              aria-label={t('heroSecondaryCta')}
            >
              <span>{t('heroSecondaryCta')}</span>
              <ArrowRight size={17} aria-hidden="true" />
            </a>

            <button
              type="button"
              onClick={handleReadIntroduction}
              className="btn btn-outline"
              style={{ minHeight: '48px', padding: '0.9rem 1.15rem' }}
              title={t('audioOverviewBtn')}
              aria-label={t('audioOverviewBtn')}
            >
              <HelpCircle size={18} aria-hidden="true" />
              <span>{t('audioOverviewBtn')}</span>
            </button>
          </div>

          {/* Minimal Status Readout */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginTop: '2.5rem',
            fontSize: '0.82rem',
            color: 'var(--text-muted)'
          }}>
            <Activity size={14} aria-hidden="true" color={healthStatus?.status === 'UP' ? 'var(--color-success)' : 'var(--color-silver-slate)'} />
            <span>
              {healthStatus?.status === 'UP'
                ? 'Academic Prototype Active • BB84 Simulation Ready'
                : 'Connecting to Prototype Services...'}
            </span>
          </div>
        </div>

        {/* Right: Abstract Ballot Design Object (No fake political content) */}
        <div>
          <div className="abstract-ballot-object" role="img" aria-label="Abstract ballot visual object">
            {/* Header / Context */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.1em', color: 'var(--text-muted)' }}>
                  {t('ballotMockHeading')}
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                  {t('ballotMockYear')}
                </div>
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-silver-slate)', letterSpacing: '0.05em' }}>
                {t('ballotMockWard')}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.65rem', background: 'var(--bg-surface-elevated)', borderRadius: '4px', width: 'fit-content' }}>
              <Vote size={14} aria-hidden="true" />
              <span style={{ fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.08em' }}>{t('ballotMockType')}</span>
            </div>

            <hr className="editorial-rule" style={{ margin: '0.5rem 0' }} />

            {/* Abstract Minimalist Option Lines */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <div className="abstract-option-row">
                <div className="abstract-option-circle" />
                <div className="abstract-option-line" />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>01</span>
              </div>
              <div className="abstract-option-row">
                <div className="abstract-option-circle selected" />
                <div className="abstract-option-line dark" />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-primary)', fontWeight: 700 }}>02</span>
              </div>
              <div className="abstract-option-row">
                <div className="abstract-option-circle" />
                <div className="abstract-option-line" />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>03</span>
              </div>
            </div>

            <hr className="editorial-rule" style={{ margin: '0.5rem 0' }} />

            {/* Abstract Protection Indicator */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.1em', color: 'var(--text-muted)' }}>
                {t('ballotMockStatus')}
              </span>
              <ShieldCheck size={16} color="var(--color-success)" aria-hidden="true" />
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 01 — WHAT ARE WE PROTECTING? (Editorial Split Layout)
          ========================================================================= */}
      <section className="editorial-section fade-in-up">
        <div className="editorial-number-label">{t('protectingNumber')}</div>
        <h2 className="editorial-section-title">
          {t('protectingTitle')}
        </h2>

        <p style={{ fontSize: '1.25rem', color: 'var(--text-primary)', maxWidth: '720px', lineHeight: 1.5, margin: '1.5rem 0 2.5rem', whiteSpace: 'pre-line' }}>
          {t('protectingSubtitle')}
        </p>

        {/* Typographic Split Concept Columns (No repeated cards) */}
        <div className="split-protecting-columns">
          {/* Left Column: Voter */}
          <div>
            <div className="protecting-column-title">
              {t('voterColumnTitle')}
            </div>
            <div className="protecting-column-item">
              <span style={{ color: 'var(--color-silver-slate)', fontWeight: 700 }}>—</span>
              <span>{t('voterItem1')}</span>
            </div>
            <div className="protecting-column-item">
              <span style={{ color: 'var(--color-silver-slate)', fontWeight: 700 }}>—</span>
              <span>{t('voterItem2')}</span>
            </div>
            <div className="protecting-column-item">
              <span style={{ color: 'var(--color-silver-slate)', fontWeight: 700 }}>—</span>
              <span>{t('voterItem3')}</span>
            </div>
          </div>

          {/* Right Column: Ballot */}
          <div>
            <div className="protecting-column-title">
              {t('ballotColumnTitle')}
            </div>
            <div className="protecting-column-item">
              <span style={{ color: 'var(--color-silver-slate)', fontWeight: 700 }}>—</span>
              <span>{t('ballotItem1')}</span>
            </div>
            <div className="protecting-column-item">
              <span style={{ color: 'var(--color-silver-slate)', fontWeight: 700 }}>—</span>
              <span>{t('ballotItem2')}</span>
            </div>
            <div className="protecting-column-item">
              <span style={{ color: 'var(--color-silver-slate)', fontWeight: 700 }}>—</span>
              <span>{t('ballotItem3')}</span>
            </div>
          </div>
        </div>

        {/* Connected Relational Flow Line */}
        <div className="relational-flow-line" role="region" aria-label="Relational protection pipeline">
          <div className="relational-flow-item">
            <Users size={16} aria-hidden="true" />
            <span>{t('flowVoter')}</span>
          </div>
          <span className="relational-flow-separator" aria-hidden="true">→</span>
          <div className="relational-flow-item">
            <CheckCircle2 size={16} aria-hidden="true" />
            <span>{t('flowVerification')}</span>
          </div>
          <span className="relational-flow-separator" aria-hidden="true">→</span>
          <div className="relational-flow-item">
            <FileCheck2 size={16} aria-hidden="true" />
            <span>{t('flowEligibility')}</span>
          </div>
          <span className="relational-flow-separator" aria-hidden="true">→</span>
          <div className="relational-flow-item">
            <Vote size={16} aria-hidden="true" />
            <span>{t('flowBallot')}</span>
          </div>
          <span className="relational-flow-separator" aria-hidden="true">→</span>
          <div className="relational-flow-item">
            <ShieldCheck size={16} aria-hidden="true" />
            <span>{t('flowProtectedStorage')}</span>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 02 — THE CENTRAL IDEA (Dramatic Full-Width #000000 Canvas)
          ========================================================================= */}
      <section className="fullwidth-dark-canvas fade-in-up">
        <div className="editorial-number-label" style={{ color: '#8C8889' }}>
          {t('section02Number')}
        </div>

        {/* Large Pearl/White Statement Lines */}
        <div className="dark-statement-line">
          {t('simplicityLine1')}
        </div>
        <div className="dark-statement-line" style={{ color: '#CFCDD3', marginTop: '-0.5rem' }}>
          {t('simplicityLine2')}
        </div>

        <p className="dark-supporting-desc">
          {t('simplicityDesc')}
        </p>

        {/* Technical Pipeline (Typographic Nodes Connected by Lines, No Cards) */}
        <div className="technical-pipeline-track" role="region" aria-label="Cryptographic pipeline">
          <div className="pipeline-node">
            <span className="pipeline-node-number">01</span>
            <span className="pipeline-node-title">{t('qflow1Title')}</span>
            <span className="pipeline-node-desc">{t('qflow1Desc')}</span>
          </div>
          <div className="pipeline-node">
            <span className="pipeline-node-number">02</span>
            <span className="pipeline-node-title">{t('qflow2Title')}</span>
            <span className="pipeline-node-desc">{t('qflow2Desc')}</span>
          </div>
          <div className="pipeline-node">
            <span className="pipeline-node-number">03</span>
            <span className="pipeline-node-title">{t('qflow3Title')}</span>
            <span className="pipeline-node-desc">{t('qflow3Desc')}</span>
          </div>
          <div className="pipeline-node">
            <span className="pipeline-node-number">04</span>
            <span className="pipeline-node-title">{t('qflow4Title')}</span>
            <span className="pipeline-node-desc">{t('qflow4Desc')}</span>
          </div>
          <div className="pipeline-node">
            <span className="pipeline-node-number">05</span>
            <span className="pipeline-node-title">{t('qflow5Title')}</span>
            <span className="pipeline-node-desc">{t('qflow5Desc')}</span>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 03 — HOW A VOTER USES IT (Horizontal Editorial Process)
          ========================================================================= */}
      <section id="how-it-works" className="editorial-section fade-in-up" style={{ scrollMarginTop: '90px' }}>
        <div className="editorial-number-label">03</div>
        <h2 className="editorial-section-title">
          {t('journeyTitle')}
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.08rem', maxWidth: '640px' }}>
          {t('journeySubtitle')}
        </p>

        {/* Editorial 7-Step Process Sequence */}
        <VotingJourney />
      </section>

      {/* =========================================================================
          SECTION 04 — INTERACTIVE WALKTHROUGH
          ========================================================================= */}
      <section id="walkthrough" className="editorial-section fade-in-up" style={{ scrollMarginTop: '90px' }}>
        <div className="editorial-number-label">04</div>
        <h2 className="editorial-section-title">
          {t('howToVoteTitle')}
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.08rem', maxWidth: '640px', marginBottom: '2rem' }}>
          {t('howToVoteSubtitle')}
        </p>

        <HowToVoteVideo />
      </section>

      {/* =========================================================================
          SECTION 05 — SECURITY BEHIND THE VOTE (Mixed Editorial List)
          ========================================================================= */}
      <section id="security" className="editorial-section fade-in-up" style={{ scrollMarginTop: '90px' }}>
        <div className="editorial-number-label">05</div>
        <h2 className="editorial-section-title">
          {t('securitySectionTitle')}
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.08rem', maxWidth: '650px' }}>
          {t('securitySectionSubtitle')}
        </p>

        {/* Mixed Composition Editorial Rows (No 4 Identical Cards) */}
        <div className="security-editorial-list" role="list">
          <div className="security-editorial-row" role="listitem">
            <div className="sec-num-col">01</div>
            <div className="sec-title-col">{t('secVoterVerificationTitle')}</div>
            <div className="sec-desc-col">{t('secVoterVerificationDesc')}</div>
          </div>

          <div className="security-editorial-row" role="listitem">
            <div className="sec-num-col">02</div>
            <div className="sec-title-col">{t('secProtectedBallotsTitle')}</div>
            <div className="sec-desc-col">{t('secProtectedBallotsDesc')}</div>
          </div>

          <div className="security-editorial-row" role="listitem">
            <div className="sec-num-col">03</div>
            <div className="sec-title-col">{t('secQkdTitle')}</div>
            <div className="sec-desc-col">{t('secQkdDesc')}</div>
          </div>

          <div className="security-editorial-row" role="listitem">
            <div className="sec-num-col">04</div>
            <div className="sec-title-col">{t('secPrivacySeparationTitle')}</div>
            <div className="sec-desc-col">{t('secPrivacySeparationDesc')}</div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 06 — ACADEMIC RESEARCH PROTOTYPE STATUS (Colophon)
          ========================================================================= */}
      <section className="fade-in-up">
        <div className="academic-identity-banner">
          <div className="academic-badge-label">
            ACADEMIC RESEARCH PROTOTYPE
          </div>
          <div className="academic-disclaimer-text">
            {t('syntheticDataNotice')}
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 07 — FINAL MONUMENTAL CTA
          ========================================================================= */}
      <section className="final-cta-monumental fade-in-up">
        <h2 className="monumental-statement">
          {t('finalCtaStatement')}
        </h2>

        <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
          <Link
            to="/login"
            className="btn btn-gold"
            style={{ fontSize: '1rem', padding: '0.95rem 2.5rem', minHeight: '48px', letterSpacing: '0.04em' }}
            aria-label={t('heroPrimaryCta')}
          >
            <LogIn size={18} aria-hidden="true" />
            <span>{t('heroPrimaryCta')}</span>
          </Link>

          <a
            href="#how-it-works"
            className="btn btn-outline"
            style={{ fontSize: '1rem', padding: '0.95rem 1.75rem', minHeight: '48px', letterSpacing: '0.03em' }}
            aria-label={t('heroSecondaryCta')}
          >
            <span>{t('heroSecondaryCta')}</span>
            <ArrowRight size={17} aria-hidden="true" />
          </a>
        </div>
      </section>
    </div>
  );
};
