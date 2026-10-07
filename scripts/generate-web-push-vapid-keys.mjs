import { createECDH } from 'node:crypto';

const keyPair = createECDH('prime256v1');
keyPair.generateKeys();

process.stdout.write([
    `WEB_PUSH_VAPID_PUBLIC_KEY=${keyPair.getPublicKey().toString('base64url')}`,
    `WEB_PUSH_VAPID_PRIVATE_KEY=${keyPair.getPrivateKey().toString('base64url')}`,
    'WEB_PUSH_VAPID_SUBJECT=mailto:notifications@example.com',
].join('\n') + '\n');
