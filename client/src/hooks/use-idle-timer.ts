import { useState, useEffect, useCallback, useRef } from 'react';

const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

interface UseIdleTimerResult {
  isIdle: boolean;
  resetTimer: () => void;
}

export function useIdleTimer(): UseIdleTimerResult {
  const [isIdle, setIsIdle] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    setIsIdle(false);
    timerRef.current = setTimeout(() => {
      setIsIdle(true);
    }, IDLE_TIMEOUT_MS);
  }, []);

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'] as const;

    const handleActivity = () => resetTimer();

    events.forEach((event) => window.addEventListener(event, handleActivity, { passive: true }));

    // Start the timer on mount
    resetTimer();

    return () => {
      events.forEach((event) => window.removeEventListener(event, handleActivity));
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [resetTimer]);

  return { isIdle, resetTimer };
}
