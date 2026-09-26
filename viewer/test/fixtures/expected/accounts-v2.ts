/**
 * Hand-written normalised model for docs/examples/accounts-v2.json with default options.
 * Design reference for the v2 normaliser (ROADMAP chunk 1.5). Note the direction mapping:
 * `subscribe` means the application sends, `publish` means it receives; the badge keeps the
 * raw keyword (`SUB`, `PUB`) and the location hint keeps the channel path.
 */
import type { Document, Message } from '../../../src/model/types.js';

const SCHEMA_FORMAT = 'application/vnd.aai.asyncapi;version=2.6.0';

const userSignedUp: Message = {
  id: 'UserSignedUp',
  anchor: 'UserSignedUp',
  name: 'UserSignedUp',
  title: 'User signed up',
  contentType: 'application/json',
  schemaFormat: SCHEMA_FORMAT,
  payload: {
    kind: 'node',
    name: '',
    path: [],
    types: ['object'],
    required: false,
    constraints: [],
    children: [
      { kind: 'node', name: 'userId', path: [], types: ['string'], required: true, description: 'Identifier of the new user', constraints: [], children: [] },
      {
        kind: 'node',
        name: 'email',
        path: [],
        types: ['string'],
        format: 'email',
        required: true,
        description: 'Primary email address, verified at signup',
        constraints: [],
        children: [],
      },
      { kind: 'node', name: 'displayName', path: [], types: ['string'], required: false, description: 'Name shown to other users', constraints: [], children: [] },
      {
        kind: 'node',
        name: 'createdAt',
        path: [],
        types: ['string'],
        format: 'date-time',
        required: false,
        description: 'When the account was created',
        constraints: [],
        children: [],
      },
    ],
  },
  examples: [
    {
      name: 'typical',
      payload: { userId: 'usr_8842', email: 'ada@example.com', displayName: 'Ada', createdAt: '2026-09-25T10:15:00Z' },
    },
  ],
  tags: [],
  bindings: [],
};

const loginFailed: Message = {
  id: 'LoginFailed',
  anchor: 'LoginFailed',
  name: 'LoginFailed',
  title: 'Login failed',
  contentType: 'application/json',
  schemaFormat: SCHEMA_FORMAT,
  payload: {
    kind: 'node',
    name: '',
    path: [],
    types: ['object'],
    required: false,
    constraints: [],
    children: [
      {
        kind: 'node',
        name: 'email',
        path: [],
        types: ['string'],
        format: 'email',
        required: true,
        description: 'Email address used in the attempt',
        constraints: [],
        children: [],
      },
      {
        kind: 'node',
        name: 'reason',
        path: [],
        types: ['string'],
        required: true,
        description: 'Why the login was rejected',
        enum: ['bad-password', 'locked', 'unknown-user'],
        constraints: [],
        children: [],
      },
      { kind: 'node', name: 'ip', path: [], types: ['string'], required: false, description: 'Client IP address, when known', constraints: [], children: [] },
    ],
  },
  examples: [],
  tags: [],
  bindings: [],
};

export const accountsV2: Document = {
  specVersion: '2.6.0',
  specMajor: 2,
  title: 'Accounts service',
  version: '1.4.0',
  description:
    'User lifecycle events. This document is an **AsyncAPI 2.6** example used by the asyncapi-viewer documentation.',
  tags: [
    { name: 'accounts', description: 'Account lifecycle' },
    { name: 'security', description: 'Authentication events' },
  ],
  servers: [
    {
      id: 'production',
      anchor: 'production',
      protocol: 'mqtt',
      hostDisplay: 'mqtt://broker.example.com:1883',
      description: 'Production broker',
      variables: [],
      security: [],
      tags: [{ name: 'accounts' }],
      bindings: [],
    },
    {
      id: 'audit',
      anchor: 'audit',
      protocol: 'mqtt',
      hostDisplay: 'mqtt://audit.example.com:1883',
      description: 'Audit trail broker',
      variables: [],
      security: [],
      tags: [{ name: 'security' }],
      bindings: [],
    },
  ],
  operations: [
    {
      id: 'onUserSignedUp',
      anchor: 'onUserSignedUp',
      heading: 'onUserSignedUp',
      action: 'send',
      kind: 'send',
      badgeLabel: 'SUB',
      locationHint: 'channels › user/signedup › subscribe',
      channel: {
        id: 'user/signedup',
        address: 'user/signedup',
        parameters: [],
        servers: [],
        tags: [],
        bindings: [],
      },
      summary: 'A new user registered',
      tags: [{ name: 'accounts' }],
      messages: [userSignedUp],
      security: [],
      bindings: [],
    },
    {
      id: 'reportLoginFailure',
      anchor: 'reportLoginFailure',
      heading: 'reportLoginFailure',
      action: 'receive',
      kind: 'receive',
      badgeLabel: 'PUB',
      locationHint: 'channels › user/login-failed › publish',
      channel: {
        id: 'user/login-failed',
        address: 'user/login-failed',
        parameters: [],
        servers: [],
        tags: [],
        bindings: [],
      },
      summary: 'Report a failed login attempt',
      tags: [{ name: 'security' }],
      messages: [loginFailed],
      security: [],
      bindings: [],
    },
  ],
  messages: [userSignedUp, loginFailed],
  schemas: [],
  problems: [],
};
