import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useAudio } from '../context/AudioContext';
import {
  Lock,
  User,
  CreditCard,
  Smartphone,
  Camera,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  RotateCcw,
  Volume2,
  ShieldCheck,
  Building2
} from 'lucide-react';

type AuthMode = 'VOTER' | 'ADMIN';
type VoterStage = 'ID' | 'OTP' | 'IDENTITY' | 'SUCCESS';

export const LoginPage: React.FC = () => {
  const [authMode, setAuthMode] = useState<AuthMode>('VOTER');
  const [voterStage, setVoterStage] = useState<VoterStage>('ID');

  // Voter inputs & states
  const [voterId, setVoterId] = useState('');
  const [stageToken, setStageToken] = useState('');
  const [maskedMobile, setMaskedMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [deliveryMode, setDeliveryMode] = useState<'demo' | 'sms'>('demo');

  // Camera & prototype identity states
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Admin inputs
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  // General UI states
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { initiateVoterLogin, verifyVoterOtp, resendVoterOtp, verifyVoterIdentity, loginAdmin } = useAuth();
  const { t, language } = useLanguage();
  const { speak } = useAudio();
  const navigate = useNavigate();

  // Handle resend countdown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Clean up camera stream on unmount or stage change
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [voterStage, authMode]);

  const startCamera = async () => {
    setCameraError(false);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: false,
        });
        streamRef.current = stream;
        setCameraActive(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch((err) => console.warn('Video play error:', err));
        }
      } else {
        setCameraError(true);
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setCameraError(true);
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  // Start camera when entering IDENTITY stage
  useEffect(() => {
    if (authMode === 'VOTER' && voterStage === 'IDENTITY') {
      startCamera();
    } else {
      stopCamera();
    }
  }, [authMode, voterStage]);

  // Ensure stream is bound to video element as soon as it mounts
  useEffect(() => {
    if (cameraActive && streamRef.current && videoRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
      }
      videoRef.current.play().catch((err) => console.warn('Video play error:', err));
    }
  }, [cameraActive, voterStage]);


  // Audio instruction helpers (never speaking private codes/tokens)
  const handleAudioHelp = () => {
    if (authMode === 'ADMIN') {
      if (language === 'te') {
        speak('దయచేసి మీ అడ్మినిస్ట్రేటర్ యూజర్‌నేమ్ మరియు పాస్‌వర్డ్ నమోదు చేసి లాగిన్ నొక్కండి.');
      } else if (language === 'hi') {
        speak('कृपया अपना व्यवस्थापक उपयोगकर्ता नाम और पासवर्ड दर्ज करके लॉगिन करें।');
      } else {
        speak('Please enter your administrator username and password, then select Sign In.');
      }
      return;
    }

    if (voterStage === 'ID') {
      if (language === 'te') {
        speak('దయచేసి మీ ఓటరు గుర్తింపు సంఖ్యను నమోదు చేసి కొనసాగించండి నొక్కండి.');
      } else if (language === 'hi') {
        speak('कृपया अपनी मतदाता पहचान संख्या दर्ज करें और आगे बढ़ें चुनें।');
      } else {
        speak('Please enter your synthetic Voter Identification Number and select Continue.');
      }
    } else if (voterStage === 'OTP') {
      if (language === 'te') {
        speak('మీ నమోదిత మొబైల్‌కు వచ్చిన ఆరు అంకెల ధృవీకరణ కోడ్‌ను నమోదు చేసి ధృవీకరించండి.');
      } else if (language === 'hi') {
        speak('अपने पंजीकृत मोबाइल पर प्राप्त छह अंकों का सत्यापन कोड दर्ज करें और सत्यापित करें।');
      } else {
        speak('Please enter the six-digit verification code sent to your registered mobile.');
      }
    } else if (voterStage === 'IDENTITY') {
      if (language === 'te') {
        speak('మీ ముఖాన్ని కెమెరా ఫ్రేమ్ మధ్యలో ఉంచండి, లేదా దిగువ డెమో ధృవీకరణను ఎంచుకోండి.');
      } else if (language === 'hi') {
        speak('कैमरा फ्रेम में अपना चेहरा रखें, या नीचे दिए गए डेमो सत्यापन का चयन करें।');
      } else {
        speak('Please position your face within the guide, or select Demo Identity Verification.');
      }
    }
  };

  // --- Step 1: Voter ID Submit ---
  const handleVoterIdSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await initiateVoterLogin(voterId.trim());
      setStageToken(res.stageToken);
      setMaskedMobile(res.maskedMobile);
      if (res.deliveryMode) {
        setDeliveryMode((res.deliveryMode as 'demo' | 'sms') || 'demo');
      }
      setVoterStage('OTP');
      setResendCooldown(60);

      if (language === 'te') {
        speak('ధృవీకరణ కోడ్ పంపబడింది. దయచేసి నమోదు చేయండి.');
      } else if (language === 'hi') {
        speak('सत्यापन कोड भेजा गया है। कृपया दर्ज करें।');
      } else {
        speak('Verification code dispatched. Please enter the six digit code.');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Unable to verify voter record. Please check your Voter ID.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // --- Step 2: OTP Submit ---
  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await verifyVoterOtp(stageToken, otp.trim());
      setStageToken(res.stageToken);
      setVoterStage('IDENTITY');

      if (language === 'te') {
        speak('మొబైల్ ధృవీకరించబడింది. ఇప్పుడు గుర్తింపు ధృవీకరణ కొనసాగించండి.');
      } else if (language === 'hi') {
        speak('मोबाइल सत्यापित हुआ। अब पहचान सत्यापन पूरा करें।');
      } else {
        speak('Mobile verification confirmed. Proceeding to identity verification.');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Invalid verification code. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // --- Step 2b: Resend OTP ---
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || loading) return;
    setError('');
    setLoading(true);

    try {
      const res = await resendVoterOtp(stageToken);
      setResendCooldown(60);
      if (res.maskedMobile) setMaskedMobile(res.maskedMobile);
      if (res.deliveryMode) {
        setDeliveryMode((res.deliveryMode as 'demo' | 'sms') || 'demo');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Please wait before requesting another verification code.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // --- Step 3: Identity Verification (Camera or Fallback) ---
  const handleVerifyIdentity = async (isFallback: boolean) => {
    setError('');
    setLoading(true);

    let frameData: string | undefined = undefined;

    if (!isFallback) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || video.videoWidth === 0) {
        setError(
          language === 'te'
            ? 'కెమెరా ప్రివ్యూ ప్రారంభమవుతోంది. దయచేసి మీ ముఖం కనిపించే వరకు వేచి ఉండండి.'
            : 'Camera preview is starting up. Please wait until your face is clearly visible before capturing.'
        );
        setLoading(false);
        return;
      }
      if (canvas) {
        const width = video.videoWidth;
        const height = video.videoHeight;
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, width, height);
          frameData = canvas.toDataURL('image/jpeg', 0.92);
        }
      }
    }

    try {
      await verifyVoterIdentity(stageToken, {
        is_demo_fallback: isFallback,
        frame_data: frameData
      });

      stopCamera();
      setVoterStage('SUCCESS');

      if (language === 'te') {
        speak('గుర్తింపు విజయవంతంగా ధృవీకరించబడింది. ఓటర్ డాష్‌బోర్డ్‌కు తీసుకెళ్తున్నాము.');
      } else if (language === 'hi') {
        speak('पहचान सफलतापूर्वक सत्यापित हो गई है। मतदाता डैशबोर्ड पर ले जाया जा रहा है।');
      } else {
        speak('Identity confirmed successfully. Navigating to your official voting dashboard.');
      }

      setTimeout(() => {
        navigate('/voter');
      }, 1500);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Prototype verification failed. Please try again or use demo verification.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // --- Admin Login Submit ---
  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await loginAdmin(adminUsername.trim(), adminPassword);
      navigate('/admin');
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Invalid administrator credentials.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Quick-fill synthetic demo voter IDs
  const handleFillVoter = (idVal: string) => {
    setVoterId(idVal);
  };

  const handleFillAdmin = () => {
    setAdminUsername('admin');
    setAdminPassword('AdminSecure2026!');
  };

  return (
    <div style={{ maxWidth: '520px', margin: '2rem auto', width: '100%', padding: '0 1rem' }}>
      {/* Top Portal Switcher Tabs */}
      <div style={{
        display: 'flex',
        borderRadius: 'var(--radius-pill)',
        background: 'var(--bg-surface-elevated)',
        padding: '0.3rem',
        marginBottom: '1.25rem',
        border: '1px solid var(--border-subtle)'
      }}>
        <button
          type="button"
          onClick={() => {
            setAuthMode('VOTER');
            setVoterStage('ID');
            setError('');
          }}
          style={{
            flex: 1,
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-pill)',
            border: 'none',
            fontWeight: 600,
            fontSize: '0.95rem',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            background: authMode === 'VOTER' ? 'var(--btn-primary-bg)' : 'transparent',
            color: authMode === 'VOTER' ? 'var(--btn-primary-text)' : 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem'
          }}
        >
          <CreditCard size={18} />
          <span>{t('voterSignInTitle')}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setAuthMode('ADMIN');
            setError('');
            stopCamera();
          }}
          style={{
            flex: 1,
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-pill)',
            border: 'none',
            fontWeight: 600,
            fontSize: '0.95rem',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            background: authMode === 'ADMIN' ? 'var(--btn-primary-bg)' : 'transparent',
            color: authMode === 'ADMIN' ? 'var(--btn-primary-text)' : 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem'
          }}
        >
          <Building2 size={18} />
          <span>{t('adminLoginTitle')}</span>
        </button>
      </div>

      {/* Main Form Container Card */}
      <div className="glass-card" style={{
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: '2rem',
        boxShadow: 'var(--shadow-md)'
      }}>
        {error && (
          <div className="alert alert-error" role="alert" aria-live="assertive" style={{ marginBottom: '1.5rem' }}>
            <AlertCircle size={18} aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW 1: VOTER AUTHENTICATION FLOW                         */}
        {/* ========================================================= */}
        {authMode === 'VOTER' && (
          <div>
            {/* STAGE 1: VOTER ID ENTRY */}
            {voterStage === 'ID' && (
              <div>
                <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
                  <div style={{
                    width: '54px',
                    height: '54px',
                    borderRadius: '50%',
                    background: 'var(--bg-surface-elevated)',
                    color: 'var(--text-primary)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '0.75rem',
                    border: '1px solid var(--border-subtle)'
                  }}>
                    <CreditCard size={26} />
                  </div>
                  <h2>{t('voterSignInTitle')}</h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                    {t('voterSignInSubtitle')}
                  </p>
                </div>

                <form onSubmit={handleVoterIdSubmit}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="voterIdInput">
                      <CreditCard size={15} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                      {t('voterIdLabel')}
                    </label>
                    <input
                      id="voterIdInput"
                      type="text"
                      className="form-control"
                      value={voterId}
                      onChange={(e) => setVoterId(e.target.value)}
                      placeholder={t('voterIdPlaceholder')}
                      required
                      autoFocus
                      style={{ fontSize: '1.05rem', letterSpacing: '0.04em' }}
                    />
                  </div>

                  {/* Synthetic Demo Voter Quick-Fill Buttons */}
                  <div style={{
                    margin: '1.25rem 0',
                    padding: '0.85rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-subtle)'
                  }}>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>
                      DEMO SYNTHETIC VOTERS (CLICK TO AUTOFILL):
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => handleFillVoter('VTR-2026-00101')}
                        className="btn btn-outline"
                        style={{ fontSize: '0.75rem', padding: '0.3rem 0.5rem', minHeight: 'auto' }}
                      >
                        Alice (VTR-2026-00101)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFillVoter('VTR-2026-00102')}
                        className="btn btn-outline"
                        style={{ fontSize: '0.75rem', padding: '0.3rem 0.5rem', minHeight: 'auto' }}
                      >
                        Bob (VTR-2026-00102)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFillVoter('VTR-2026-00201')}
                        className="btn btn-outline"
                        style={{ fontSize: '0.75rem', padding: '0.3rem 0.5rem', minHeight: 'auto' }}
                      >
                        Charlie (VTR-2026-00201)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFillVoter('VTR-2026-00301')}
                        className="btn btn-outline"
                        style={{ fontSize: '0.75rem', padding: '0.3rem 0.5rem', minHeight: 'auto' }}
                      >
                        Divya (Bhimili)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFillVoter('VTR-2026-00302')}
                        className="btn btn-outline"
                        style={{ fontSize: '0.75rem', padding: '0.3rem 0.5rem', minHeight: 'auto' }}
                      >
                        Murthy (Bobbili)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFillVoter('VTR-2026-00303')}
                        className="btn btn-outline"
                        style={{ fontSize: '0.75rem', padding: '0.3rem 0.5rem', minHeight: 'auto' }}
                      >
                        Mahesh (Gajuwaka)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFillVoter('VTR-2026-00304')}
                        className="btn btn-outline"
                        style={{ fontSize: '0.75rem', padding: '0.3rem 0.5rem', minHeight: 'auto' }}
                      >
                        Gupta (Anakapalle)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFillVoter('VTR-2026-00401')}
                        className="btn btn-outline"
                        style={{ fontSize: '0.75rem', padding: '0.3rem 0.5rem', minHeight: 'auto' }}
                      >
                        Tarun (Visakhapatnam East)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFillVoter('VTR-2026-00402')}
                        className="btn btn-outline"
                        style={{ fontSize: '0.75rem', padding: '0.3rem 0.5rem', minHeight: 'auto' }}
                      >
                        Aswin (Visakhapatnam North)
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <button
                      type="button"
                      onClick={handleAudioHelp}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-gold)',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem'
                      }}
                    >
                      <Volume2 size={16} />
                      <span>{language === 'te' ? 'సహాయం వినండి' : language === 'hi' ? 'मार्गदर्शन सुनें' : 'Audio Guide'}</span>
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !voterId.trim()}
                    className="btn btn-gold"
                    style={{ width: '100%', fontSize: '1.05rem', justifyContent: 'center' }}
                  >
                    {loading ? (
                      <span>{language === 'te' ? 'పరిశీలిస్తోంది...' : 'Verifying Record...'}</span>
                    ) : (
                      <>
                        <span>{t('continueBtn')}</span>
                        <ArrowRight size={18} />
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}

            {/* STAGE 2: OTP VERIFICATION */}
            {voterStage === 'OTP' && (
              <div>
                <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
                  <div style={{
                    width: '54px',
                    height: '54px',
                    borderRadius: '50%',
                    background: 'var(--bg-surface-elevated)',
                    color: 'var(--text-primary)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '0.75rem',
                    border: '1px solid var(--border-subtle)'
                  }}>
                    <Smartphone size={26} />
                  </div>
                  <h2>{t('mobileVerificationTitle')}</h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                    {t('mobileVerificationDesc')} <strong style={{ color: 'var(--text-primary)' }}>{maskedMobile}</strong>.
                  </p>
                </div>

                {deliveryMode === 'demo' ? (
                  <div style={{
                    padding: '0.65rem 0.85rem',
                    borderRadius: '6px',
                    background: 'rgba(59, 130, 246, 0.08)',
                    border: '1px solid rgba(59, 130, 246, 0.25)',
                    fontSize: '0.82rem',
                    color: 'var(--text-muted)',
                    marginBottom: '1.5rem',
                    lineHeight: '1.4'
                  }}>
                    <strong style={{ color: '#3b82f6' }}>Demo Simulation Notice:</strong> In this academic prototype, the 6-digit verification code has been printed to the backend terminal console.
                  </div>
                ) : (
                  <div style={{
                    padding: '0.65rem 0.85rem',
                    borderRadius: '6px',
                    background: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    fontSize: '0.82rem',
                    color: 'var(--text-muted)',
                    marginBottom: '1.5rem',
                    lineHeight: '1.4'
                  }}>
                    <strong style={{ color: '#10b981' }}>SMS Delivery:</strong> A 6-digit verification code has been dispatched via SMS to your registered mobile number.
                  </div>
                )}

                <form onSubmit={handleOtpSubmit}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="otpInput">
                      <Lock size={15} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                      {t('enterSixDigitOtp')}
                    </label>
                    <input
                      id="otpInput"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      className="form-control"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                      placeholder="• • • • • •"
                      required
                      autoFocus
                      style={{
                        fontSize: '1.5rem',
                        letterSpacing: '0.4em',
                        textAlign: 'center',
                        fontWeight: 700
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={resendCooldown > 0 || loading}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: resendCooldown > 0 ? 'var(--text-muted)' : 'var(--text-gold)',
                        cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer',
                        fontSize: '0.85rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem'
                      }}
                    >
                      <RotateCcw size={15} />
                      <span>
                        {resendCooldown > 0
                          ? `${t('resendWaitNotice')} ${resendCooldown}s`
                          : t('resendOtpBtn')}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={handleAudioHelp}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-gold)',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem'
                      }}
                    >
                      <Volume2 size={16} />
                      <span>{language === 'te' ? 'సహాయం వినండి' : 'Audio Guide'}</span>
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || otp.length < 6}
                    className="btn btn-gold"
                    style={{ width: '100%', fontSize: '1.05rem', justifyContent: 'center' }}
                  >
                    {loading ? (
                      <span>{language === 'te' ? 'ధృవీకరిస్తోంది...' : 'Validating Code...'}</span>
                    ) : (
                      <>
                        <span>{t('verifyOtpBtn')}</span>
                        <ArrowRight size={18} />
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}

            {/* STAGE 3: PROTOTYPE IDENTITY VERIFICATION */}
            {voterStage === 'IDENTITY' && (
              <div>
                <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                  <div style={{
                    width: '54px',
                    height: '54px',
                    borderRadius: '50%',
                    background: 'var(--bg-surface-elevated)',
                    color: 'var(--text-primary)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '0.75rem',
                    border: '1px solid var(--border-subtle)'
                  }}>
                    <Camera size={26} />
                  </div>
                  <h2>{t('prototypeIdentityTitle')}</h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem', lineHeight: '1.4' }}>
                    {t('prototypeIdentityDisclaimer')}
                  </p>
                </div>

                {/* Camera Viewport or Fallback Message */}
                <div style={{
                  position: 'relative',
                  width: '100%',
                  height: '280px',
                  borderRadius: '12px',
                  background: '#090d16',
                  overflow: 'hidden',
                  marginBottom: '1.25rem',
                  border: '1px solid var(--border-glass)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {/* Keep video permanently in DOM when in IDENTITY stage so ref is always mounted */}
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      transform: 'scaleX(-1)', // Mirror effect for natural preview
                      display: cameraActive && !cameraError ? 'block' : 'none'
                    }}
                    onLoadedMetadata={() => {
                      if (videoRef.current) {
                        videoRef.current.play().catch(() => {});
                      }
                    }}
                  />

                  {cameraActive && !cameraError ? (
                    <>
                      {/* Biometric Framing Guide Oval */}
                      <div style={{
                        position: 'absolute',
                        width: '160px',
                        height: '210px',
                        borderRadius: '50%',
                        border: '3px solid #38bdf8',
                        boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.45)',
                        pointerEvents: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <div style={{
                          position: 'absolute',
                          top: '-13px',
                          background: '#0284c7',
                          color: '#ffffff',
                          fontSize: '0.68rem',
                          padding: '2px 8px',
                          borderRadius: '9999px',
                          fontWeight: 700,
                          letterSpacing: '0.5px',
                          textTransform: 'uppercase',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                        }}>
                          Align Face Here
                        </div>
                      </div>
                      <div style={{
                        position: 'absolute',
                        bottom: '12px',
                        fontSize: '0.78rem',
                        background: 'rgba(15, 23, 42, 0.85)',
                        backdropFilter: 'blur(4px)',
                        color: '#f8fafc',
                        padding: '0.3rem 0.75rem',
                        borderRadius: '20px',
                        border: '1px solid rgba(255,255,255,0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                        {t('cameraInstruction')}
                      </div>
                    </>
                  ) : cameraError ? (
                    <div style={{ textAlign: 'center', padding: '1.25rem', color: 'var(--text-muted)' }}>
                      <Camera size={38} style={{ opacity: 0.6, marginBottom: '0.5rem', color: 'var(--color-rose-gold)' }} />
                      <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{t('cameraAccessDenied')}</div>
                      <p style={{ fontSize: '0.75rem', marginTop: '0.35rem', maxWidth: '320px' }}>
                        Unable to access your webcam. Check browser permissions or click below to retry.
                      </p>
                      <button
                        type="button"
                        onClick={startCamera}
                        className="btn btn-secondary"
                        style={{ marginTop: '0.75rem', fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                      >
                        Retry Camera
                      </button>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '1.25rem', color: 'var(--text-muted)' }}>
                      <Camera size={36} style={{ opacity: 0.5, marginBottom: '0.5rem' }} />
                      <div style={{ fontSize: '0.85rem' }}>Activating optical camera feed...</div>
                    </div>
                  )}
                  <canvas ref={canvasRef} style={{ display: 'none' }} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {cameraActive && !cameraError && (
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => handleVerifyIdentity(false)}
                      className="btn btn-gold"
                      style={{ width: '100%', fontSize: '1rem', justifyContent: 'center' }}
                    >
                      {loading ? (
                        <span>{language === 'te' ? 'ముఖ గుర్తింపు పరిశీలిస్తోంది...' : 'Verifying Face with DeepFace AI...'}</span>
                      ) : (
                        <>
                          <Camera size={18} />
                          <span>{t('captureAndVerifyBtn')}</span>
                        </>
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleVerifyIdentity(true)}
                    className="btn btn-outline"
                    style={{
                      width: '100%',
                      fontSize: '0.95rem',
                      justifyContent: 'center',
                      borderColor: 'var(--border-subtle)',
                      color: 'var(--text-primary)'
                    }}
                  >
                    <ShieldCheck size={18} />
                    <span>{t('demoIdentityBtn')}</span>
                  </button>

                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '0.25rem' }}>
                    {t('demoFallbackNotice')}
                  </div>
                </div>
              </div>
            )}

            {/* STAGE 4: VERIFICATION SUCCESSFUL */}
            {voterStage === 'SUCCESS' && (
              <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#10b981',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '1rem',
                  border: '1px solid #10b981'
                }}>
                  <CheckCircle2 size={34} />
                </div>
                <h2>{t('verificationSuccessfulTitle')}</h2>
                <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '0.95rem' }}>
                  {t('verificationSuccessfulDesc')}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW 2: ADMINISTRATOR LOGIN                               */}
        {/* ========================================================= */}
        {authMode === 'ADMIN' && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
              <div style={{
                width: '54px',
                height: '54px',
                borderRadius: '50%',
                background: 'var(--bg-surface-elevated)',
                color: 'var(--text-primary)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '0.75rem',
                border: '1px solid var(--border-subtle)'
              }}>
                <Lock size={26} />
              </div>
              <h2>{t('adminLoginTitle')}</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                {t('adminLoginSubtitle')}
              </p>
            </div>

            <form onSubmit={handleAdminSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="adminUsername">
                  <User size={15} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                  {language === 'te' ? 'యూజర్‌నేమ్' : language === 'hi' ? 'उपयोगकर्ता नाम' : 'Username'}
                </label>
                <input
                  id="adminUsername"
                  type="text"
                  className="form-control"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  placeholder="e.g. admin"
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="adminPassword">
                  <Lock size={15} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                  {language === 'te' ? 'పాస్‌వర్డ్' : language === 'hi' ? 'पासवर्ड' : 'Password'}
                </label>
                <input
                  id="adminPassword"
                  type="password"
                  className="form-control"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleAudioHelp}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-gold)',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem'
                  }}
                >
                  <Volume2 size={16} />
                  <span>{language === 'te' ? 'సహాయం వినండి' : 'Audio Guide'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleFillAdmin}
                  style={{
                    background: 'var(--color-soft-gold-dim)',
                    border: '1px solid var(--color-soft-gold)',
                    color: 'var(--text-gold)',
                    cursor: 'pointer',
                    fontSize: '0.78rem',
                    padding: '0.25rem 0.6rem',
                    borderRadius: '4px'
                  }}
                >
                  Autofill Admin Demo
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn btn-gold"
                style={{ width: '100%', fontSize: '1.05rem', justifyContent: 'center' }}
              >
                {loading ? (
                  <span>{language === 'te' ? 'ధృవీకరిస్తోంది...' : 'Authenticating...'}</span>
                ) : (
                  <>
                    <span>{t('adminLoginTitle')}</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
