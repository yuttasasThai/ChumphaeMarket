// Audio notification utilities using Web Audio API synthesis & Web Speech API

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new AudioContextClass();
    }
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch (e) {
    console.debug('Error getting AudioContext:', e);
    return null;
  }
}

export function unlockAudio() {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
}

function playChimeAlert(tone: 'alert' | 'success') {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    
    // Ensure active time context
    const now = ctx.currentTime;

    if (tone === 'alert') {
      // Clear, loud, dual-chime alert for incoming order
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, now); // E5
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5
      gain1.gain.setValueAtTime(0.4, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.45);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(1174.66, now + 0.16); // D6
      gain2.gain.setValueAtTime(0.45, now + 0.16);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.16);
      osc2.stop(now + 0.8);
    } else {
      // Pleasant success chime
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, now); // C5
      osc1.frequency.exponentialRampToValueAtTime(659.25, now + 0.15); // E5
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.45);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(783.99, now + 0.15); // G5
      gain2.gain.setValueAtTime(0.35, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.75);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.75);
    }
  } catch (e) {
    console.debug('Audio context sound error:', e);
  }
}

function speakThaiText(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'th-TH';
    utterance.rate = 1.0;
    utterance.pitch = 1.1;

    // Try finding a Thai voice if available
    const voices = window.speechSynthesis.getVoices();
    const thaiVoice = voices.find((v) => v.lang.includes('th') || v.lang.includes('TH'));
    if (thaiVoice) {
      utterance.voice = thaiVoice;
    }

    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.debug('Speech synthesis error:', e);
  }
}

// 1. Play sound and voice "มีออเดอร์เข้า" for ADMIN ONLY
export function playAdminOrderSound() {
  unlockAudio();
  playChimeAlert('alert');
  setTimeout(() => {
    speakThaiText('มีออเดอร์เข้า');
  }, 220);
}

// 2. Play sound and voice "รับสินค้าแล้ว" for CUSTOMER ONLY
export function playCustomerDeliveredSound() {
  unlockAudio();
  playChimeAlert('success');
  setTimeout(() => {
    speakThaiText('รับสินค้าแล้ว');
  }, 220);
}

// Backward compatibility alias
export const playOrderNotificationSound = playAdminOrderSound;
