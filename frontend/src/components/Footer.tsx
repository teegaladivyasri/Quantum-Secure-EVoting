import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { ShieldCheck, Info } from 'lucide-react';

export const Footer: React.FC = () => {
  const { language } = useLanguage();

  return (
    <footer style={{
      background: 'var(--bg-surface)',
      borderTop: '1px solid var(--border-subtle)',
      padding: '2rem 1.5rem',
      marginTop: 'auto',
      fontSize: '0.9rem',
      color: 'var(--text-secondary)'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        textAlign: 'center',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)', fontWeight: 600 }}>
          <ShieldCheck size={20} />
          <span>
            {language === 'te' 
              ? 'క్వాంటమ్-రక్షిత ఎలక్ట్రానిక్ ఓటింగ్ పరిశోధనా నమూనా (Qiskit BB84 + AES-256-GCM)'
              : language === 'hi'
                ? 'क्वांटम-सुरक्षित इलेक्ट्रॉनिक मतदान अनुसंधान प्रोटोटाइप (Qiskit BB84 + AES-256-GCM)'
                : 'Quantum-Secure Electronic Voting Research Prototype (Qiskit BB84 + AES-256-GCM)'}
          </span>
        </div>

        <p style={{ maxWidth: '850px', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          <Info size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
          {language === 'te'
            ? 'గమనిక: ఇది ఒక విద్యాసంబంధ/పరిశోధనా సాఫ్ట్‌వేర్ నమూనా. ఇది క్లాసికల్ హార్డ్‌వేర్‌పై క్వాంటమ్ కీ డిస్ట్రిబ్యూషన్‌ను అనుకరిస్తుంది మరియు వాస్తవ ఎన్నికల కోసం ఉద్దేశించినది కాదు.'
            : language === 'hi'
              ? 'अकादमिक अनुसंधान सूचना: यह एक सॉफ्टवेयर अनुसंधान प्रोटोटाइप है जो क्लासिकल हार्डवेयर पर Qiskit के माध्यम से क्वांटम कुंजी वितरण का अनुकरण करता है। यह वास्तविक चुनावों के लिए आधिकारिक प्लेटफॉर्म नहीं है।'
              : 'Academic Research Notice: This is a software research prototype simulating Quantum Key Distribution on classical hardware via Qiskit. It is not an unhackable or government-certified election platform.'}
        </p>

        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          © 2026 Academic Research Prototype • Midnight Mist (#000000) • Silver Slate (#8C8889) • Clouded Pearl (#CFCDD3) • Pure Snow (#FFFFFF)
        </div>
      </div>
    </footer>
  );
};
