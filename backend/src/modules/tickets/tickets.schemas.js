import { z } from 'zod';
import { entityId } from '../../shared/request-validation.js';

export const eventReferenceSchema = z.object({ eventId: entityId });
export const ticketReferenceSchema = z.object({ ticketId: entityId });
