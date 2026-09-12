/**
 * Audio feedback module with Natural Indonesian Voice Engine (Google AI Studio style)
 * Specially tuned with warm, human-like cadence for Special Needs School (SLB / SKH) students.
 */

class AudioFeedbackManager {
  private audioCtx: AudioContext | null = null;
  private indonesianVoice: SpeechSynthesisVoice | null = null;
  private currentAudio: HTMLAudioElement | null = null;

  constructor() {
    this.initVoices();
  }

  private initVoices() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const findVoice = () => {
      this.indonesianVoice = this.getBestIndonesianVoice();
    };

    findVoice();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = findVoice;
    }
  }

  /**
   * Intelligently selects the highest-quality Natural / AI voice available in the browser.
   * Priority:
   * 1. Google AI Studio / Google Assistant Neural Indonesian voice ("Google Bahasa Indonesia")
   * 2. Edge / Azure Natural Neural Indonesian voice ("Gadis Online (Natural)" / "Ardi Online (Natural)")
   * 3. Apple Natural Indonesian voice (e.g. Damayanti / Siri)
   * 4. Modern non-desktop Indonesian voices
   * 5. Fallback standard Indonesian voices
   */
  public getBestIndonesianVoice(): SpeechSynthesisVoice | null {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;

    // Rank 1: Google Natural Neural Indonesian Voice (as heard in Google AI Studio / Assistant)
    const googleIdVoice = voices.find(
      v =>
        (v.lang.toLowerCase().startsWith('id') || v.name.toLowerCase().includes('indonesia')) &&
        v.name.toLowerCase().includes('google')
    );
    if (googleIdVoice) return googleIdVoice;

    // Rank 2: Microsoft Edge Azure Natural Neural Indonesian Voice
    const edgeNaturalVoice = voices.find(
      v =>
        (v.lang.toLowerCase().startsWith('id') || v.name.toLowerCase().includes('indonesia')) &&
        (v.name.toLowerCase().includes('natural') || v.name.toLowerCase().includes('online') || v.name.toLowerCase().includes('neural'))
    );
    if (edgeNaturalVoice) return edgeNaturalVoice;

    // Rank 3: Apple / Siri Indonesian voice
    const appleIdVoice = voices.find(
      v =>
        v.lang.toLowerCase().startsWith('id') &&
        (v.name.toLowerCase().includes('damayanti') || v.name.toLowerCase().includes('siri'))
    );
    if (appleIdVoice) return appleIdVoice;

    // Rank 4: Any Indonesian voice that is NOT the old robotic SAPI desktop voice
    const nonDesktopIdVoice = voices.find(
      v =>
        (v.lang.toLowerCase().startsWith('id') || v.lang.toLowerCase().startsWith('in')) &&
        !v.name.toLowerCase().includes('desktop')
    );
    if (nonDesktopIdVoice) return nonDesktopIdVoice;

    // Rank 5: Any Indonesian voice available
    const anyIdVoice = voices.find(
      v =>
        v.lang.toLowerCase().startsWith('id') ||
        v.lang.toLowerCase().startsWith('in') ||
        v.name.toLowerCase().includes('indonesia')
    );
    return anyIdVoice || null;
  }

  private initAudioContext() {
    if (!this.audioCtx) {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  /**
   * Play a harmonious, child-friendly 4-note celebration chime
   */
  playCelebrationChime() {
    try {
      this.initAudioContext();
      if (!this.audioCtx) return;

      const now = this.audioCtx.currentTime;
      const notes = [
        { freq: 523.25, time: 0.0, dur: 0.35 }, // C5
        { freq: 659.25, time: 0.12, dur: 0.4 }, // E5
        { freq: 783.99, time: 0.24, dur: 0.65 }, // G5
        { freq: 1046.5, time: 0.36, dur: 0.85 }, // C6
      ];

      notes.forEach(({ freq, time, dur }) => {
        if (!this.audioCtx) return;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + time);

        gain.gain.setValueAtTime(0.001, now + time);
        gain.gain.exponentialRampToValueAtTime(0.25, now + time + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + time + dur);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(now + time);
        osc.stop(now + time + dur + 0.05);
      });
    } catch (e) {
      console.warn('Audio chime error:', e);
    }
  }

  /**
   * Speak text with high-quality natural Indonesian AI voice (like Google AI Studio / Gemini)
   */
  speakText(text: string) {
    if (!text || !text.trim()) return;

    // Clean formatting and optimize pauses for natural conversational rhythm
    const cleanText = text
      .replace(/[•*#_~`🎯👉👈👆✓]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Cancel any previous audio/speech
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch (e) {}
      this.currentAudio = null;
    }
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }

    // Dynamic resolution of best voice (Google AI voice preferred)
    const voice = this.indonesianVoice || this.getBestIndonesianVoice();

    // Primary: Web Speech API with Natural Indonesian AI Voice
    if ('speechSynthesis' in window) {
      try {
        const utterance = new SpeechSynthesisUtterance(cleanText);
        if (voice) {
          utterance.voice = voice;
          utterance.lang = voice.lang || 'id-ID';
        } else {
          utterance.lang = 'id-ID';
        }

        // Natural conversational parameters like Google AI Studio (warm, human, fluid)
        utterance.rate = 0.98; // Natural, friendly conversational speed
        utterance.pitch = 1.0; // Warm, natural human pitch (no robotic distortion)
        utterance.volume = 1.0;

        window.speechSynthesis.speak(utterance);
        return;
      } catch (e) {
        console.warn('Local speech synthesis error, using audio stream fallback:', e);
      }
    }

    // Fallback: Google Voice TTS audio stream
    try {
      const audioUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=id&client=tw-ob&q=${encodeURIComponent(
        cleanText
      )}`;
      const audio = new Audio(audioUrl);
      this.currentAudio = audio;
      audio.play().catch(playErr => {
        console.warn('Audio stream playback notice:', playErr);
      });
    } catch (err) {
      console.warn('Audio playback error:', err);
    }
  }
}

export const audioFeedback = new AudioFeedbackManager();
