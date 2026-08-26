import test from 'node:test';import assert from 'node:assert/strict';import {paginate} from '../src/api.js';test('page 1 starts at first item',()=>assert.deepEqual(paginate([1,2,3],1,2),[1,2]))
