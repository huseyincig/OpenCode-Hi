import test from 'node:test';import assert from 'node:assert/strict';import {parse} from './index.js';test('slugifies repeated spaces',()=>assert.equal(parse('Hello   World'),'hello-world'))
