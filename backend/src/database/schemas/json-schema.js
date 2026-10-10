import { z } from 'zod';
import { databaseRecordSchema, recordSchemas } from './index.js';
import * as entities from './club.schema.js';

export function databaseJsonSchema() {
  const registry = z.registry();
  for (const [name, schema] of Object.entries(recordSchemas))
    registry.add(schema, { id: name + 'Record' });
  for (const [name, schema] of Object.entries(entities))
    if (name.endsWith('Schema') && !registry.has(schema))
      registry.add(schema, { id: name.replace(/Schema$/, '') });
  return {
    ...z.toJSONSchema(databaseRecordSchema, { metadata: registry, reused: 'ref', io: 'input' }),
    title: 'Skyline DynamoDB record schema',
    description:
      'Version 1. Runtime validation additionally enforces identity/key consistency, unique entity IDs, event capacity and percentage discount bounds. See docs/DATABASE.md.',
    'x-schema-version': 1,
  };
}
