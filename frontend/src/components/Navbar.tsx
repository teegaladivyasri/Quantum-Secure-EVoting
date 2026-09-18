import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useAudio } from '../context/AudioContext';
import { Shield, Sun, Moon, Volume2, VolumeX, LogOut, User } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, isAuthenticated, logout, isAdmin, isVoter } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const { isAudioEnabled, toggleAudio, speak } = useAudio();
  const navigate = useNavigate();

  const handleAudioToggle = () => {
    toggleAudio();
    if (!isAudioEnabled) {
      speak(language === 'te' ? 'ఆడియో గైడ్ సక్రియం చేయబడింది' : 'Audio guidance activated');
    }
  };

  const handleLanguageChange = (lang: 'en' | 'te' | 'hi') => {
    setLanguage(lang);
    if (isAudioEnabled) {
      if (lang === 'te') {
        speak('తెలుగు భాష ఎంచుకోబడింది');
      } else if (lang === 'hi') {
        speak('हिन्दी भाषा चुनी गई');
      } else {
        speak('English language selected');
      }
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header style={{
      background: 'var(--nav-bg)',
      color: 'var(--nav-text)',
      borderBottom: '1px solid var(--nav-border)',
      padding: '0.85rem 1.5rem',
      boxShadow: 'var(--shadow-sm)',
      position: 'sticky',
      top: 0,
      zIndex: 100
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        {/* Brand / Logo */}
        <Link to="/" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          textDecoration: 'none',
          color: 'var(--nav-text)'
        }}>
          <div style={{
            background: 'var(--btn-primary-bg)',
            color: 'var(--btn-primary-text)',
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <Shield size={22} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem', letterSpacing: '-0.01em', color: 'var(--nav-text)' }}>
              {t('systemTitle')}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {isVoter ? t('secureVotingPortal') : (isAdmin ? 'BB84 QKD Simulation • AES-256-GCM' : t('securePortalAria'))}
            </div>
          </div>
        </Link>

        {/* Action Controls & Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Navigation Links */}
          <Link to="/" className="nav-text-link" aria-label={t('home')}>
            {t('home')}
          </Link>

          <a href="/#how-it-works" className="nav-text-link" aria-label={t('howItWorks')}>
            {t('howItWorks')}
          </a>

          <a href="/#security" className="nav-text-link" aria-label={t('securityNav')}>
            {t('securityNav')}
          </a>

          {isVoter && (
            <Link to="/voter" className="btn btn-gold" style={{ minHeight: '42px', padding: '0.45rem 1rem' }} aria-label={t('dashboard')}>
              {t('dashboard')}
            </Link>
          )}

          {isAdmin && (
            <Link to="/admin" className="btn btn-gold" style={{ minHeight: '42px', padding: '0.45rem 1rem' }} aria-label={t('adminDashboard')}>
              {t('adminDashboard')}
            </Link>
          )}

          {/* Language Switcher (EN / TE / HI) */}
          <div style={{
            display: 'inline-flex',
            background: 'var(--bg-surface-elevated)',
            borderRadius: '8px',
            padding: '2px',
            border: '1px solid var(--border-subtle)'
          }}>
            <button
              onClick={() => handleLanguageChange('en')}
              style={{
                background: language === 'en' ? 'var(--btn-primary-bg)' : 'transparent',
                color: language === 'en' ? 'var(--btn-primary-text)' : 'var(--nav-text)',
                border: 'none',
                minHeight: '38px',
                padding: '4px 10px',
                borderRadius: '6px',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
              aria-label="Switch to English"
            >
              EN
            </button>
            <button
              onClick={() => handleLanguageChange('te')}
              style={{
                background: language === 'te' ? 'var(--btn-primary-bg)' : 'transparent',
                color: language === 'te' ? 'var(--btn-primary-text)' : 'var(--nav-text)',
                border: 'none',
                minHeight: '38px',
                padding: '4px 10px',
                borderRadius: '6px',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
              aria-label="తెలుగులోకి మారండి"
            >
              తెలుగు
            </button>
            <button
              onClick={() => handleLanguageChange('hi')}
              style={{
                background: language === 'hi' ? 'var(--btn-primary-bg)' : 'transparent',
                color: language === 'hi' ? 'var(--btn-primary-text)' : 'var(--nav-text)',
                border: 'none',
                minHeight: '38px',
                padding: '4px 10px',
                borderRadius: '6px',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
              aria-label="हिन्दी में बदलें"
            >
              हिन्दी
            </button>
          </div>

          {/* Audio Guidance Toggle */}
          <button
            onClick={handleAudioToggle}
            className="btn btn-outline"
            style={{
              minHeight: '44px',
              padding: '0.5rem 0.85rem',
              color: 'var(--nav-text)',
              borderColor: 'var(--border-subtle)',
              background: isAudioEnabled ? 'var(--bg-surface-elevated)' : 'transparent'
            }}
            title={isAudioEnabled ? t('audioGuideOn') : t('audioGuideOff')}
            aria-label={isAudioEnabled ? t('audioGuideOn') : t('audioGuideOff')}
          >
            {isAudioEnabled ? <Volume2 size={20} aria-hidden="true" /> : <VolumeX size={20} aria-hidden="true" />}
          </button>

          {/* Theme Switcher */}
          <button
            onClick={toggleTheme}
            className="btn btn-outline"
            style={{
              minHeight: '44px',
              padding: '0.5rem 0.85rem',
              color: 'var(--nav-text)',
              borderColor: 'var(--border-subtle)'
            }}
            title={theme === 'dark' ? t('lightMode') : t('darkMode')}
            aria-label={theme === 'dark' ? t('lightMode') : t('darkMode')}
          >
            {theme === 'dark' ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}
          </button>

          {/* User Status / Login / Logout */}
          {isAuthenticated ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.85rem',
                color: 'var(--text-primary)',
                background: 'var(--bg-surface-elevated)',
                padding: '0.4rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                minHeight: '44px'
              }}>
                <User size={16} aria-hidden="true" />
                <span>{user?.username} ({user?.role})</span>
              </div>
              <button
                onClick={handleLogout}
                className="btn btn-outline"
                style={{
                  minHeight: '44px',
                  padding: '0.5rem 0.85rem',
                  color: 'var(--color-danger)',
                  borderColor: 'rgba(197, 48, 48, 0.35)'
                }}
                title={t('logout')}
                aria-label={t('logout')}
              >
                <LogOut size={18} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <Link to="/login" className="btn btn-gold" style={{ minHeight: '44px', padding: '0.5rem 1.2rem' }} aria-label={t('login')}>
              {t('login')}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};
