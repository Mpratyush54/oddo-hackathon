import type { ZodType } from 'zod';

export const digitsSchema: ZodType<string>;
export const promoCodeSchema: ZodType<string>;
export const requestKeySchema: ZodType<string>;
export const phoneSchema: ZodType<string>;
export const optionalPhoneSchema: ZodType<string>;
export const graphVersionSchema: ZodType<string>;
export const sha256Schema: ZodType<string>;
export function normalizePhone(value: unknown): string;
export function removeTrailingSlash(value: string): string;
