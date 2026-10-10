import QRCode from 'qrcode';

export type MembershipCardInput = {
  clubName: string;
  name: string;
  course: string;
  memberId: string;
  role: string;
  expires: string;
  valid: boolean;
  qrPayload: string;
};

/** Fixed pixel size — same output on every device. */
export const MEMBER_CARD_WIDTH = 720;
export const MEMBER_CARD_HEIGHT = 420;

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  font: string,
): string {
  ctx.font = font;
  if (ctx.measureText(text).width <= maxWidth) return text;
  let value = text;
  while (value.length > 1 && ctx.measureText(`${value}…`).width > maxWidth) {
    value = value.slice(0, -1);
  }
  return `${value}…`;
}

async function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not render QR code.'));
    img.src = src;
  });
}

/** Deterministic canvas card — shared by preview, download, and print. */
export async function renderMembershipCardCanvas(input: MembershipCardInput) {
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      /* continue with fallback fonts */
    }
  }

  const width = MEMBER_CARD_WIDTH;
  const height = MEMBER_CARD_HEIGHT;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create card image.');

  const display = '"Outfit", Arial, sans-serif';
  const body = '"Source Sans 3", Arial, sans-serif';

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#143f34');
  gradient.addColorStop(0.55, '#0f564c');
  gradient.addColorStop(1, '#0e635b');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Soft highlight
  const glow = ctx.createRadialGradient(560, 80, 20, 560, 80, 260);
  glow.addColorStop(0, 'rgba(230,199,119,0.16)');
  glow.addColorStop(1, 'rgba(230,199,119,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#e6c777';
  ctx.font = `700 30px ${display}`;
  ctx.fillText('skyline.', 40, 54);

  ctx.fillStyle = '#a4c9b6';
  ctx.font = `650 12px ${body}`;
  ctx.textAlign = 'right';
  ctx.fillText('VOLUNTEER MEMBERSHIP', width - 40, 42);
  ctx.textAlign = 'left';

  ctx.fillStyle = '#a4c9b6';
  ctx.font = `600 13px ${body}`;
  ctx.fillText(
    fitText(ctx, input.clubName.toUpperCase(), 420, `600 13px ${body}`),
    40,
    98,
  );

  ctx.fillStyle = '#ffffff';
  ctx.font = `700 34px ${display}`;
  ctx.fillText(fitText(ctx, input.name, 420, `700 34px ${display}`), 40, 150);

  ctx.fillStyle = '#d9eae1';
  ctx.font = `500 17px ${body}`;
  ctx.fillText(fitText(ctx, input.course || 'Campus volunteer', 420, `500 17px ${body}`), 40, 184);

  ctx.fillStyle = input.valid ? '#9fd4b5' : '#e6c777';
  ctx.font = `650 14px ${body}`;
  ctx.fillText(input.valid ? 'Valid membership' : 'Membership pending', 40, 232);

  ctx.fillStyle = '#ffffff';
  ctx.font = `600 16px ui-monospace, "Cascadia Mono", Consolas, monospace`;
  ctx.fillText(input.memberId, 40, 260);

  ctx.fillStyle = '#a4c9b6';
  ctx.font = `500 14px ${body}`;
  ctx.fillText(
    fitText(
      ctx,
      `${input.role || 'Volunteer'}  ·  Expires ${input.expires}`,
      420,
      `500 14px ${body}`,
    ),
    40,
    286,
  );

  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(40, 334);
  ctx.lineTo(width - 40, 334);
  ctx.stroke();

  ctx.fillStyle = '#a4c9b6';
  ctx.font = `500 14px ${body}`;
  ctx.fillText('Belong here. Build together.', 40, 372);

  if (input.qrPayload) {
    const qrUrl = await QRCode.toDataURL(input.qrPayload, {
      width: 180,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#123f38', light: '#ffffff' },
    });
    const qrImage = await loadImage(qrUrl);
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, width - 236, 118, 196, 196, 18);
    ctx.fill();
    ctx.drawImage(qrImage, width - 226, 128, 176, 176);
  }

  const dataUrl = canvas.toDataURL('image/png');
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => {
      if (value) resolve(value);
      else reject(new Error('Could not export membership card.'));
    }, 'image/png');
  });
  return { canvas, dataUrl, blob };
}

export function downloadMembershipCard(blob: Blob, memberId: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${memberId || 'skyline'}-membership-card.png`;
  link.click();
  URL.revokeObjectURL(url);
}

/** Print the same PNG at a fixed card size (device-independent). */
export function printMembershipCardImage(dataUrl: string) {
  const frame = window.open('', '_blank', 'noopener,noreferrer,width=860,height=560');
  if (!frame) throw new Error('Allow pop-ups to print your membership card.');
  frame.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Skyline membership card</title>
    <style>
      @page { size: auto; margin: 12mm; }
      html, body {
        margin: 0;
        background: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100%;
      }
      img {
        width: 90mm;
        height: 52.5mm;
        object-fit: contain;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      @media print {
        html, body { min-height: auto; }
      }
    </style>
  </head>
  <body>
    <img id="card" src="${dataUrl}" alt="Membership card" />
    <script>
      const img = document.getElementById('card');
      const go = () => { window.focus(); window.print(); };
      if (img.complete) setTimeout(go, 50);
      else img.onload = () => setTimeout(go, 50);
    </script>
  </body>
</html>`);
  frame.document.close();
}
