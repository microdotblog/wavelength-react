// Runnable self-check for the one piece of non-trivial logic in Micropub.js:
// resolving the uploaded/published URL from the Location header or JSON body.
// Run with: node src/api/__checks__/micropub_check.mjs
import assert from 'node:assert/strict';

import { resolve_uploaded_url } from '../Micropub.js';

assert.equal(
  resolve_uploaded_url('https://example.micro.blog/uploads/episode.m4a', null),
  'https://example.micro.blog/uploads/episode.m4a',
  'Location header should win',
);

assert.equal(
  resolve_uploaded_url('  https://example.micro.blog/p.m4a  ', null),
  'https://example.micro.blog/p.m4a',
  'Location header should be trimmed',
);

assert.equal(
  resolve_uploaded_url('', { url: 'https://example.micro.blog/uploads/from-body.m4a' }),
  'https://example.micro.blog/uploads/from-body.m4a',
  'JSON url should be used when header is empty',
);

assert.equal(
  resolve_uploaded_url(null, { url: '  https://example.micro.blog/from-body.m4a ' }),
  'https://example.micro.blog/from-body.m4a',
  'JSON url should be trimmed when header is missing',
);

assert.equal(resolve_uploaded_url(null, null), '', 'Missing header and body should yield empty string');
assert.equal(resolve_uploaded_url('', {}), '', 'Empty header and body without url should yield empty string');

console.log('Micropub resolve_uploaded_url check passed.');
