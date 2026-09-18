import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useLanguage } from './LanguageContext';

interface AudioContextType {
  isAudioEnabled: boolean;
  toggleAudio: () => void;
  speak: (text: string) => void;
  stopAudio: () => void;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAudioEnabled, setIsAudioEnabled] = useState<boolean>(() => {
    return localStorage.getItem('app_audio_enabled') === 'true';
  });

  const { language } = useLanguage();
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    const updateVoices = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
    };

    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;

    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const toggleAudio = () => {
    setIsAudioEnabled((prev) => {
      const next = !prev;
      localStorage.setItem('app_audio_enabled', String(next));
      if (!next && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      return next;
    });
  };

  const stopAudio = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  };

  const speak = (text: string) => {
    if (!isAudioEnabled) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    try {
      window.speechSynthesis.cancel(); // Cancel any ongoing speech

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95; // Slightly measured institutional pace
      utterance.pitch = 1.0;

      const availableVoices = voicesRef.current.length > 0
        ? voicesRef.current
        : window.speechSynthesis.getVoices();

      if (language === 'te') {
        utterance.lang = 'te-IN';
        // Attempt to find an installed Telugu voice (te-IN or te)
        const teVoice = availableVoices.find(
          (v) => v.lang === 'te-IN' || v.lang.startsWith('te') || v.name.toLowerCase().includes('telugu')
        );
        if (teVoice) {
          utterance.voice = teVoice;
        }
      } else if (language === 'hi') {
        utterance.lang = 'hi-IN';
        // Attempt to find an installed Hindi voice (hi-IN or hi)
        const hiVoice = availableVoices.find(
          (v) => v.lang === 'hi-IN' || v.lang.startsWith('hi') || v.name.toLowerCase().includes('hindi')
        );
        if (hiVoice) {
          utterance.voice = hiVoice;
        }
      } else {
        utterance.lang = 'en-IN';
        // Attempt to find an Indian English or general English voice
        const enVoice = availableVoices.find(
          (v) => v.lang === 'en-IN' || v.lang.startsWith('en')
        );
        if (enVoice) {
          utterance.voice = enVoice;
        }
      }

      // Graceful error handling in case speech engine fails or voice is missing
      utterance.onerror = (e) => {
        // Continue visual operation gracefully without throwing uncaught exceptions
        if (e.error !== 'canceled' && e.error !== 'interrupted') {
          console.warn('Voice guidance notice: Speech synthesis could not complete audio stream.', e.error);
        }
      };

      window.speechSynthesis.speak(utterance);
    } catch {
      // Gracefully continue visual operation if Speech API throws
    }
  };

  return (
    <AudioContext.Provider value={{ isAudioEnabled, toggleAudio, speak, stopAudio }}>
      {children}
    </AudioContext.Provider>
  );
};

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) throw new Error('useAudio must be used within AudioProvider');
  return context;
};
