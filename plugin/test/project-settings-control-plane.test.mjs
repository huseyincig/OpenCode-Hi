import test from "node:test"
import assert from "node:assert/strict"
import {mkdtempSync,mkdirSync,readFileSync,rmSync,writeFileSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {applyProjectSettings} from "../dist/config/project-settings.js"
import {resolveHiConfigWithReport} from "../dist/config/resolver.js"

const fixture=()=>mkdtempSync(join(tmpdir(),"hi-settings-"))
const routing=root=>join(root,".opencode","hi","policy","routing.json")

test("project settings transaction preserves unknown fields and applies work mode plus multiple role models atomically",()=>{
  const root=fixture();try{
    mkdirSync(join(root,".opencode","hi","policy"),{recursive:true})
    writeFileSync(routing(root),JSON.stringify({schema:1,type:"hi-routing",unknownTop:{keep:true},execution:{future:"keep",topology:"adaptive",maxAgents:4,parallelism:2},routing:{future:{keep:true},adaptiveRoles:["future-role","architect"],roleModels:{architect:["p/old"],"future-role":["p/future"]}}},null,2))
    const out=applyProjectSettings(root,{workMode:"multi",maxAgents:3,parallelism:2,roleModels:{coder:["p/code","p/fallback"],architect:null}})
    assert.equal(out.workMode,"multi");assert.deepEqual(out.roleModels.coder,["p/code","p/fallback"]);assert.equal(out.roleModels.architect,undefined)
    const doc=JSON.parse(readFileSync(routing(root),"utf8"));assert.deepEqual(doc.unknownTop,{keep:true});assert.equal(doc.execution.future,"keep");assert.equal(doc.execution.topology,"multi-agent");assert.equal(doc.execution.maxAgents,3);assert.equal(doc.execution.parallelism,2);assert.deepEqual(doc.routing.future,{keep:true});assert.ok(doc.routing.adaptiveRoles.includes("future-role"));assert.deepEqual(doc.routing.roleModels["future-role"],["p/future"])
    const cfg=resolveHiConfigWithReport({},root).config;assert.equal(cfg.execution.topology,"multi-agent");assert.deepEqual(cfg.routing.roleModels.coder,["p/code","p/fallback"]);assert.equal(cfg.routing.roleModels.architect,undefined)
  }finally{rmSync(root,{recursive:true,force:true})}
})

test("single work mode enforces one active agent and serial topology",()=>{
  const root=fixture();try{
    applyProjectSettings(root,{workMode:"single",maxAgents:8,parallelism:8})
    const cfg=resolveHiConfigWithReport({},root).config;assert.equal(cfg.execution.topology,"single-agent");assert.equal(cfg.execution.maxAgents,1);assert.equal(cfg.execution.parallelism,1)
  }finally{rmSync(root,{recursive:true,force:true})}
})

test("invalid transaction performs no partial write",()=>{
  const root=fixture();try{
    applyProjectSettings(root,{workMode:"adaptive",roleModels:{coder:["p/a"]}})
    const before=readFileSync(routing(root),"utf8")
    assert.throws(()=>applyProjectSettings(root,{workMode:"multi",maxAgents:99,roleModels:{coder:["p/b"]}}),/maxAgents/)
    assert.equal(readFileSync(routing(root),"utf8"),before)
    assert.throws(()=>applyProjectSettings(root,{roleModels:{manager:["p/main"]}}),/Unsupported Hi child role/)
    assert.equal(readFileSync(routing(root),"utf8"),before)
  }finally{rmSync(root,{recursive:true,force:true})}
})

test("reset returns all managed child roles to automatic without deleting foreign role data",()=>{
  const root=fixture();try{
    mkdirSync(join(root,".opencode","hi","policy"),{recursive:true})
    writeFileSync(routing(root),JSON.stringify({schema:1,type:"hi-routing",routing:{roleModels:{coder:["p/a"],architect:["p/b"],"future-role":["p/future"]}}}))
    applyProjectSettings(root,{workMode:"adaptive",resetRoleModels:true})
    const doc=JSON.parse(readFileSync(routing(root),"utf8"));assert.equal(doc.execution.topology,"adaptive");assert.equal(doc.routing.roleModels.coder,undefined);assert.equal(doc.routing.roleModels.architect,undefined);assert.deepEqual(doc.routing.roleModels["future-role"],["p/future"]);assert.equal(doc.routing.modelPolicy,"adaptive")
  }finally{rmSync(root,{recursive:true,force:true})}
})
