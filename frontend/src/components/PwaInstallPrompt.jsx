import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (isStandalone) {
      return;
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!sessionStorage.getItem('pwa_dismissed')) {
        setShowPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);

    const timer = setTimeout(() => {
      if (!isStandalone && !sessionStorage.getItem('pwa_dismissed')) {
        setShowPrompt(true);
      }
    }, 1500);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      clearTimeout(timer);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    } else {
      alert('To install the app, click the install icon in your browser URL bar or Add to Home Screen in your browser menu.');
      setShowPrompt(false);
    }
  };

  const handleClose = () => {
    setShowPrompt(false);
    setDismissed(true);
    sessionStorage.setItem('pwa_dismissed', 'true');
  };

  if (!showPrompt || dismissed) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#121E2C] text-[#F1F5F9] px-4 py-2.5 shadow-2xl flex items-center justify-between border-t border-[#22354B]">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Download className="w-4 h-4 text-[#4A8CD2] animate-bounce" />
        <span>Install Universal POS App on your device for fast offline access!</span>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={handleClose}
          className="text-xs text-[#94A3B8] hover:text-white transition-colors"
        >
          Close
        </button>
        <button
          onClick={handleInstall}
          className="bg-[#0A4174] hover:bg-[#062E52] text-white font-bold px-4 py-1.5 rounded-lg text-xs transition-colors shadow-sm flex items-center gap-1.5"
        >
          <Download className="w-3.5 h-3.5" />
          Install App
        </button>
      </div>
    </div>
  );
}
