import test from 'node:test';import assert from 'node:assert/strict';import {normalize} from './index.js';test('normalizes whitespace',()=>assert.equal(normalize(' A '),'a'))
