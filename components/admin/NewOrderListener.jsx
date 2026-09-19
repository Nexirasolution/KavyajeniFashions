'use client';

import { useEffect, useRef } from 'react';

function playBeep() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();

  const notes = [523, 659, 784, 1047]; // C5 → E5 → G5 → C6 (ascending chime)

  notes.forEach((freq, i) => {
    const delay = i * 0.35;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // Add slight reverb feel with a second oscillator
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    // Main tone
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
    gain.gain.setValueAtTime(1.5, ctx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.6);
    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + 0.6);

    // Harmonic layer (octave below, softer)
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(freq / 2, ctx.currentTime + delay);
    gain2.gain.setValueAtTime(0.6, ctx.currentTime + delay);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.5);
    osc2.start(ctx.currentTime + delay);
    osc2.stop(ctx.currentTime + delay + 0.5);
  });
}
export default function NewOrderListener() {
  const prevCountRef = useRef(null);

  useEffect(() => {
    async function checkOrders() {
      try {
        const res = await fetch('/api/orders?limit=1&page=1');
        if (!res.ok) return;
        const data = await res.json();

        const currentCount = data.total; // ✅ use total count, not latest ID

        if (prevCountRef.current === null) {
          // First load — store silently
          prevCountRef.current = currentCount;
          return;
        }

        const newOrders = currentCount - prevCountRef.current;

        if (newOrders > 0) {
          prevCountRef.current = currentCount;

          // Beep once per new order
          for (let i = 0; i < newOrders; i++) {
            setTimeout(() => playBeep(), i * 600);
          }
        }
      } catch (err) {
        console.error('Order poll failed:', err);
      }
    }

    checkOrders();
    const interval = setInterval(checkOrders, 10000);
    return () => clearInterval(interval);
  }, []);

  return null;
}