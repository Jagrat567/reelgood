'use client';

import { useEffect } from 'react';

export function PwaRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
        // The site remains usable when service workers are unavailable.
      });
    };

    if (document.readyState === 'complete') {
      register();
      return;
    }

    window.addEventListener('load', register, { once: true });
    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}
