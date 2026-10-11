export const DEFAULT_EVENT_IMAGES: string[];
export const EVENT_IMAGE_SVG_FALLBACK: string;
export function isUsableImageUrl(value: unknown): value is string;
export function resolveEventImage(image: string | undefined | null, seed?: string): string;
export function nextEventImageFallback(seed?: string, attempt?: number): string;
