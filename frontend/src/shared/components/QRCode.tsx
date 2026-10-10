import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import '../styles/portal.css';
import '../../features/landing/styles/landing.css';

export function QR({ value }: { value: string }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, {
      width: 220,
      margin: 2,
      color: { dark: '#123f38', light: '#ffffff' },
    }).then((url) => {
      if (active) setSrc(url);
    });
    return () => {
      active = false;
    };
  }, [value]);
  return src ? (
    <img className="portal-qr" src={src} alt="Scannable QR code" />
  ) : (
    <span>Generating QR…</span>
  );
}
