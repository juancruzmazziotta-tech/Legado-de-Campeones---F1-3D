import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { X, Download, Smartphone, QrCode as QrIcon, Check, Copy } from 'lucide-react';
import { triggerHaptic } from '../audio/engineSound';

interface QRModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PUBLIC_SHARED_URL = 'https://ais-pre-dqswsdh3d3dwjyzc5c5ij7-675036450752.us-west2.run.app';

export const QRModal: React.FC<QRModalProps> = ({ isOpen, onClose }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [selectedUrlType, setSelectedUrlType] = useState<'shared' | 'current' | 'custom'>('shared');
  const [customUrl, setCustomUrl] = useState<string>('');
  const [activeUrl, setActiveUrl] = useState<string>(PUBLIC_SHARED_URL);

  useEffect(() => {
    let url = PUBLIC_SHARED_URL;
    if (selectedUrlType === 'current' && typeof window !== 'undefined') {
      url = window.location.href;
    } else if (selectedUrlType === 'custom') {
      url = customUrl || PUBLIC_SHARED_URL;
    } else {
      url = PUBLIC_SHARED_URL;
    }

    setActiveUrl(url);

    QRCode.toDataURL(url, {
      width: 400,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    })
      .then((dataUri) => setQrDataUrl(dataUri))
      .catch((err) => console.error('Error generating QR:', err));
  }, [isOpen, selectedUrlType, customUrl]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(activeUrl);
    setCopied(true);
    triggerHaptic(20);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = 'F1-Legado-de-Campeones-QR.png';
    a.click();
    triggerHaptic(25);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg bg-[#181818] border border-white/10 rounded-2xl p-6 shadow-2xl flex flex-col items-center max-h-[92vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={() => {
            triggerHaptic(15);
            onClose();
          }}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition"
          aria-label="Cerrar modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 rounded-full bg-[#FF1801]"></div>
          <span className="text-xs uppercase tracking-widest text-[#FF1801] font-racing font-bold">
            Punto de Acceso Físico / Digital
          </span>
        </div>
        <h2 className="text-2xl font-racing font-bold text-white text-center mb-1">
          ESCANEA CON TU SMARTPHONE
        </h2>
        <p className="text-sm text-white/70 text-center mb-5 max-w-sm">
          Vive la experiencia inmersiva móvil con giroscopio, vista de piloto cockpit y volante háptico en tu dispositivo.
        </p>

        {/* QR Code Presentation Graphic Card */}
        <div className="w-full bg-[#121212] border-2 border-[#FF1801]/40 rounded-xl p-5 flex flex-col items-center shadow-inner relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#FF1801] via-[#FFD700] to-[#FF1801]"></div>

          <div className="flex items-center justify-between w-full mb-3 text-xs text-white/60 font-racing">
            <span className="flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-[#FFD700]" /> Mobile-First 3D
            </span>
            <span className="text-[#FFD700]">PARCIAL 2 • D&PW II</span>
          </div>

          {/* QR Canvas / Image */}
          <div className="bg-white p-3 rounded-lg shadow-md border-4 border-white/10 mb-3">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="Código QR de Acceso F1 3D" className="w-48 h-48 object-contain" />
            ) : (
              <div className="w-48 h-48 flex items-center justify-center text-black/50">
                <QrIcon className="w-10 h-10 animate-spin" />
              </div>
            )}
          </div>

          <p className="text-xs text-center text-white/80 font-medium">
            Apunta la cámara de tu celular al código QR para ingresar directamente.
          </p>

          {/* Active URL source selector */}
          <div className="w-full mt-3 pt-3 border-t border-white/10 flex flex-col items-center gap-1.5">
            <span className="text-[10px] uppercase font-racing text-white/40 tracking-wider">
              Destino del QR:
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedUrlType('shared')}
                className={`px-2.5 py-1 rounded text-[10px] font-racing transition cursor-pointer ${
                  selectedUrlType === 'shared'
                    ? 'bg-[#FF1801] text-white font-bold'
                    : 'bg-white/5 text-white/60 hover:text-white'
                }`}
              >
                URL Pública Compartida
              </button>
              <button
                type="button"
                onClick={() => setSelectedUrlType('current')}
                className={`px-2.5 py-1 rounded text-[10px] font-racing transition cursor-pointer ${
                  selectedUrlType === 'current'
                    ? 'bg-[#FF1801] text-white font-bold'
                    : 'bg-white/5 text-white/60 hover:text-white'
                }`}
              >
                URL del Navegador
              </button>
            </div>
            <div className="w-full max-w-xs text-[10px] text-white/50 truncate text-center bg-black/40 px-2 py-1 rounded border border-white/5 font-mono">
              {activeUrl}
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 text-[11px] text-white/50 bg-white/5 px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Compatible con iOS Safari y Android Chrome
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 w-full mt-5">
          <button
            onClick={handleDownload}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium text-xs transition border border-white/10"
          >
            <Download className="w-4 h-4 text-[#FFD700]" />
            Descargar QR PNG
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#FF1801] hover:bg-[#d41400] text-white font-racing font-bold text-xs uppercase tracking-wider transition shadow-lg shadow-[#FF1801]/30"
          >
            {copied ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copiado!' : 'Copiar URL'}
          </button>
        </div>

        {/* Presentation Mockup Info for Exam */}
        <div className="mt-4 pt-4 border-t border-white/10 w-full text-center">
          <p className="text-[11px] text-white/50">
            Requisito de entrega: Afiche de presentación y acceso directo para evaluación en dispositivos reales.
          </p>
        </div>
      </div>
    </div>
  );
};
