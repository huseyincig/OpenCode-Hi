import http from 'node:http'
import { Store } from './store.js'
const store=new Store(new URL('../data.json',import.meta.url))
const json=(res,status,body)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(body))}
export const server=http.createServer(async(req,res)=>{
  const body=async()=>{let s='';for await(const c of req)s+=c;return s?JSON.parse(s):{}}
  if(req.method==='GET'&&req.url==='/items') return json(res,200,await store.all())
  if(req.method==='POST'&&req.url==='/items'){const x=await body();await store.add(x);return json(res,201,x)}
  const m=req.url.match(/^\/items\/([^/]+)$/)
  if(m&&req.method==='PUT'){const x=await body();const out=await store.updateStock(m[1],x.stock);return json(res,out?200:404,out??{error:'missing'})}
  if(m&&req.method==='DELETE'){await store.remove(m[1]);return json(res,204,{})}
  json(res,404,{error:'not found'})
})
if(process.argv[1]===new URL(import.meta.url).pathname) server.listen(process.env.PORT||3000)
