import { describe, expect, it } from 'vitest';
import { flattenBinding } from '../src/render/details.js';

describe('flattenBinding', () => {
  it('keeps scalars, flattens nested objects with dotted keys, joins scalar arrays, keeps schema-shaped values', () => {
    expect(flattenBinding({ scope: 'channel', protocol: 'kafka', key: 'partitions', value: 3 })).toEqual([{ key: 'partitions', value: 3 }]);
    expect(
      flattenBinding({ scope: 'channel', protocol: 'kafka', key: 'topicConfiguration', value: { 'cleanup.policy': ['delete'], 'retention.ms': 60000000 } }),
    ).toEqual([
      { key: 'topicConfiguration.cleanup.policy', value: 'delete' },
      { key: 'topicConfiguration.retention.ms', value: 60000000 },
    ]);
    const schema = { type: 'string', description: 'The groupId' };
    expect(flattenBinding({ scope: 'operation', protocol: 'kafka', key: 'groupId', value: schema })).toEqual([{ key: 'groupId', value: schema }]);
    expect(flattenBinding({ scope: 'channel', protocol: 'amqp', key: 'queue', value: { name: 'q', durable: true, extra: { x: [1, 2] } } })).toEqual([
      { key: 'queue.name', value: 'q' },
      { key: 'queue.durable', value: true },
      { key: 'queue.extra.x', value: '1 · 2' },
    ]);
  });
});
