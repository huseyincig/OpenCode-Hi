export type JsonSchema = Record<string, unknown>
export type PluginToolDefinition = {
  description: string
  args?: Record<string, JsonSchema>
  execute: (args: any, ctx: any) => Promise<any> | any
}
type HhcSchema = JsonSchema & { __hhc_optional?: true; optional: () => HhcSchema }
interface NativeToolFactory {
  (definition:PluginToolDefinition):PluginToolDefinition
  schema:{ string:()=>HhcSchema; number:()=>HhcSchema; boolean:()=>HhcSchema }
}
function scalar(type:'string'|'number'|'boolean',isOptional=false):HhcSchema{
  const base:any={type};if(isOptional)base.__hhc_optional=true;base.optional=()=>scalar(type,true);return base as HhcSchema
}
function clean(schema:HhcSchema):JsonSchema{const {__hhc_optional:_,optional:__,...rest}=schema;return rest}
const makeTool=(definition:PluginToolDefinition):PluginToolDefinition=>{
  const args=definition.args??{},entries=Object.entries(args) as [string,HhcSchema][]
  if(!entries.some(([,schema])=>schema?.__hhc_optional===true))return{...definition,args:Object.fromEntries(entries.map(([k,v])=>[k,clean(v)]))}
  const properties=Object.fromEntries(entries.map(([k,v])=>[k,clean(v)])),required=entries.filter(([,v])=>v?.__hhc_optional!==true).map(([k])=>k)
  return{description:definition.description,args:{input:{type:'object',properties,required,additionalProperties:false}},execute:(raw:any,ctx:any)=>definition.execute(raw?.input??raw??{},ctx)}
}
export const nativeTool:NativeToolFactory=Object.assign(makeTool,{schema:{string:()=>scalar('string'),number:()=>scalar('number'),boolean:()=>scalar('boolean')}})
