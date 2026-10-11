import { useEffect, useState } from 'react';
import {
  EVENT_IMAGE_SVG_FALLBACK,
  nextEventImageFallback,
  resolveEventImage,
} from '../../../../shared/event-images.js';

type EventPhotoProps = {
  image?: string | null;
  seed?: string;
  alt: string;
  className?: string;
  loading?: 'lazy' | 'eager';
};

/** Renders an event cover with stock fallbacks when the stored URL is empty or broken. */
export function EventPhoto({ image, seed = '', alt, className, loading = 'lazy' }: EventPhotoProps) {
  const resolved = resolveEventImage(image, seed);
  const [src, setSrc] = useState(resolved);
  const [tries, setTries] = useState(0);

  useEffect(() => {
    setSrc(resolveEventImage(image, seed));
    setTries(0);
  }, [image, seed]);

  return (
    <img
      className={className}
      src={src}
      alt={alt}
      loading={loading}
      referrerPolicy="no-referrer"
      onError={() => {
        const next = nextEventImageFallback(seed, tries);
        setTries((n) => n + 1);
        setSrc(next || EVENT_IMAGE_SVG_FALLBACK);
      }}
    />
  );
}
