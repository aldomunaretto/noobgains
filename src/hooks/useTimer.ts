import { useState, useEffect, useCallback, useRef } from "react";

export function useTimer(targetSeconds: number) {
  const [elapsed, setElapsed] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  const remaining = Math.max(0, targetSeconds - elapsed);
  const progress = targetSeconds > 0 ? Math.min(100, (elapsed / targetSeconds) * 100) : 0;
  const isDone = elapsed >= targetSeconds && targetSeconds > 0;

  const start = useCallback(() => {
    setElapsed(0);
    startTimeRef.current = Date.now();
    setIsRunning(true);
  }, []);

  const stop = useCallback(() => {
    setIsRunning(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    stop();
    setElapsed(0);
  }, [stop]);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = window.setInterval(() => {
        const now = Date.now();
        setElapsed(Math.floor((now - startTimeRef.current) / 1000));
      }, 250);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  // Vibra cuando el timer termina
  useEffect(() => {
    if (isDone && isRunning) {
      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200, 100, 400]);
      }
    }
  }, [isDone, isRunning]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return {
    elapsed,
    remaining,
    progress,
    isRunning,
    isDone,
    start,
    stop,
    reset,
    formattedRemaining: formatTime(remaining),
    formattedElapsed: formatTime(elapsed),
    formattedTarget: formatTime(targetSeconds),
  };
}
