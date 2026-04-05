import { useState, useEffect } from 'react';

export interface Toast {
  id: number;
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

type ToastInput = Omit<Toast, 'id'>;
type Listener = () => void;

let toasts: Toast[] = [];
let nextId = 1;
const listeners: Set<Listener> = new Set();

function notify() {
  listeners.forEach((listener) => listener());
}

function addToast(input: ToastInput): Toast {
  const t: Toast = { ...input, id: nextId++ };
  toasts = [...toasts, t];
  notify();

  setTimeout(() => {
    dismiss(t.id);
  }, 5000);

  return t;
}

function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  notify();
}

export function toast(input: ToastInput): Toast {
  return addToast(input);
}

export function useToast() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick((n) => n + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return {
    toasts,
    toast: addToast,
    dismiss,
  };
}
