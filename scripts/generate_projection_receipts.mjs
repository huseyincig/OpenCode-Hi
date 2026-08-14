#!/usr/bin/env node
import {writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {buildProjectionReceipts} from './projection_receipts.mjs'
const root=resolve(fileURLToPath(new URL('..',import.meta.url)))
const out=resolve(root,'data/validation/projection-receipts.json')
const receipts=buildProjectionReceipts(root)
writeFileSync(out,JSON.stringify(receipts,null,2)+'\n','utf8')
console.log(`generated ${receipts.length} projection receipts -> data/validation/projection-receipts.json`)
