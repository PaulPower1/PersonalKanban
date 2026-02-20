import { useState, useCallback, useRef } from 'react';
import { KanbanBoard } from '../types';
import { COLUMNS } from '../constants/columns';

export function useVoiceReadout() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const speak = useCallback((board: KanbanBoard) => {
    if (!isSupported) return;

    window.speechSynthesis.cancel();

    const parts: string[] = [];
    for (const col of COLUMNS) {
      const cards = board.cards
        .filter((c) => c.columnId === col.id)
        .sort((a, b) => a.order - b.order);

      if (cards.length > 0) {
        const titles = cards.map((c) => c.title).join(', ');
        parts.push(`In ${col.title}: ${titles}.`);
      } else {
        parts.push(`${col.title} is empty.`);
      }
    }

    const text = parts.join(' ');
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    utteranceRef.current = utterance;

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }, [isSupported]);

  const stop = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, [isSupported]);

  return { speak, stop, isSpeaking, isSupported };
}
