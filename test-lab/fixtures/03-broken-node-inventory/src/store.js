import { readFile, writeFile } from 'node:fs/promises'
export class Store {
  constructor(path){ this.path=path }
  async all(){ try { return JSON.parse(await readFile(this.path,'utf8')) } catch { return [] } }
  async save(items){ await writeFile(this.path, JSON.stringify(items,null,2)) }
  async add(item){ const items=await this.all(); items.push(item); await this.save(items); return item }
  async updateStock(sku,stock){ const items=await this.all(); const x=items.find(i=>i.sku===sku); if(!x) return null; x.stock=stock; await this.save(items); return x }
  async remove(sku){ const items=await this.all(); await this.save(items.filter(i=>i.sku!==sku)); return true }
}
