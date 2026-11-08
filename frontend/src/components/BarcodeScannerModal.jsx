import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, AlertCircle } from 'lucide-react';

export default function BarcodeScannerModal({ isOpen, onClose, onScanSuccess }) {
  const [error, setError] = useState('');
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const scannerRef = useRef(null);
  const containerId = 'barcode-scanner-viewport';

  useEffect(() => {
    if (!isOpen) return;
    setError('');

    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length > 0) {
          setCameras(devices);
          // Prefer back camera if available
          const backCam = devices.find((d) => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('rear'));
          setSelectedCamera(backCam ? backCam.id : devices[0].id);
        } else {
          setError('No camera detected on this device');
        }
      })
      .catch((err) => {
        setError('Camera permission denied or camera not found: ' + (err?.message || err));
      });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !selectedCamera) return;

    let html5QrCode = null;
    try {
      html5QrCode = new Html5Qrcode(containerId);
      scannerRef.current = html5QrCode;

      const config = {
        fps: 15,
        qrbox: { width: 280, height: 160 },
        aspectRatio: 1.777778,
      };

      html5QrCode.start(
        selectedCamera,
        config,
        (decodedText) => {
          if (decodedText) {
            // Beep audio indicator on scan
            try {
              const ctx = new (window.AudioContext || window.webkitAudioContext)();
              const osc = ctx.createOscillator();
              osc.type = 'sine';
              osc.frequency.setValueAtTime(880, ctx.currentTime);
              osc.connect(ctx.destination);
              osc.start();
              osc.stop(ctx.currentTime + 0.15);
            } catch {}

            onScanSuccess(decodedText.trim());
            stopScanner();
            onClose();
          }
        },
        () => {
          // Frame parse error - ignore standard noise
        }
      ).catch((err) => {
        setError('Failed to start camera: ' + (err?.message || err));
      });
    } catch (e) {
      setError('Scanner init failed: ' + (e?.message || e));
    }

    return () => {
      stopScanner();
    };
  }, [isOpen, selectedCamera]);

  const stopScanner = () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          scannerRef.current.stop().then(() => {
            try { scannerRef.current.clear(); } catch {}
          }).catch(() => {});
        }
      } catch {}
      scannerRef.current = null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#121E2C] border border-[#DCE5EF] dark:border-[#22354B] shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#DCE5EF] dark:border-[#22354B]">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-[#0A4174] dark:text-[#4A8CD2]" />
            <h3 className="font-bold text-sm text-[#1C2736] dark:text-[#F1F5F9]">
              Live Barcode Scanner
            </h3>
          </div>
          <button
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="p-1 rounded-lg text-[#5A6B82] hover:bg-[#E2EDF8] dark:hover:bg-[#1A2A3D]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Camera Selector */}
        {cameras.length > 1 && (
          <div className="px-4 py-2 bg-[#F4F7FB] dark:bg-[#1A2A3D]/50 border-b border-[#DCE5EF] dark:border-[#22354B] text-xs flex items-center gap-2">
            <span className="font-semibold text-[#5A6B82]">Camera:</span>
            <select
              value={selectedCamera}
              onChange={(e) => setSelectedCamera(e.target.value)}
              className="flex-1 rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] px-2 py-1 text-xs"
            >
              {cameras.map((c) => (
                <option key={c.id} value={c.id}>{c.label || `Camera ${c.id}`}</option>
              ))}
            </select>
          </div>
        )}

        {/* Video Viewport */}
        <div className="p-4 bg-black relative flex items-center justify-center min-h-[260px]">
          <div id={containerId} className="w-full rounded-xl overflow-hidden" />
        </div>

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950/40 border-t border-red-200 dark:border-red-900 text-xs text-red-600 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Footer info */}
        <div className="px-4 py-3 bg-[#F4F7FB] dark:bg-[#121E2C] text-center border-t border-[#DCE5EF] dark:border-[#22354B]">
          <p className="text-[11px] text-[#5A6B82] dark:text-[#94A3B8]">
            Point your camera at a barcode to scan and automatically add the product to your bill
          </p>
        </div>
      </div>
    </div>
  );
}

