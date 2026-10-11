/** Stable stock covers when an event has no usable image URL. */
export const DEFAULT_EVENT_IMAGES = [
  'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1000&q=85',
  'https://images.unsplash.com/photo-1484723091739-30a097e8f929?auto=format&fit=crop&w=1000&q=85',
  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1000&q=85',
  'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1000&q=85',
  'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=1200&q=85',
  'https://images.unsplash.com/photo-1523580494863-6f3031224c94?auto=format&fit=crop&w=1200&q=85',
  'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=1200&q=85',
  'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=1200&q=85',
];

const SVG_FALLBACK =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="700" viewBox="0 0 900 700">
      <rect width="900" height="700" fill="#1a3832"/>
      <text x="450" y="360" fill="#e8f0ea" font-family="Georgia,serif" font-size="42" text-anchor="middle">skyline.</text>
    </svg>`,
  );

export function isUsableImageUrl(value) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    (value.startsWith('https://') || value.startsWith('http://') || value.startsWith('data:image/'))
  );
}

function hashSeed(seed) {
  const text = String(seed || '');
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return hash;
}

/** Pick a stable stock cover from an event id / index when image is missing. */
export function resolveEventImage(image, seed = '') {
  if (isUsableImageUrl(image)) return image;
  return DEFAULT_EVENT_IMAGES[hashSeed(seed) % DEFAULT_EVENT_IMAGES.length] || SVG_FALLBACK;
}

export function nextEventImageFallback(seed, attempt = 0) {
  if (attempt >= DEFAULT_EVENT_IMAGES.length) return SVG_FALLBACK;
  return DEFAULT_EVENT_IMAGES[(hashSeed(seed) + attempt + 1) % DEFAULT_EVENT_IMAGES.length];
}

export const EVENT_IMAGE_SVG_FALLBACK = SVG_FALLBACK;
