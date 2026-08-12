export type JsonSchema = Record<string, unknown>
export type PluginToolDefinition = {
  description: string
  args?: Record<string, JsonSchema>
  execute: (args: any, ctx: any) => Promise<any> | any
}
type HiSchema = JsonSchema & { __hi_optional?: true; optional: () => HiSchema }
interface NativeToolFactory {
  (definition:PluginToolDefinition):PluginToolDefinition
  schema:{ string:()=>HiSchema; number:()=>HiSchema; boolean:()=>HiSchema }
}
function scalar(type:'string'|'number'|'boolean',isOptional=false):HiSchema{
  const base:any={type};if(isOptional)base.__hi_optional=true;base.optional=()=>scalar(type,true);return base as HiSchema
}
function clean(schema:HiSchema):JsonSchema{const {__hi_optional:_,optional:__,...rest}=schema;return rest}
const makeTool=(definition:PluginToolDefinition):PluginToolDefinition=>{
  const args=definition.args??{},entries=Object.entries(args) as [string,HiSchema][]
  if(!entries.some(([,schema])=>schema?.__hi_optional===true))return{...definition,args:Object.fromEntries(entries.map(([k,v])=>[k,clean(v)]))}
  const properties=Object.fromEntries(entries.map(([k,v])=>[k,clean(v)])),required=entries.filter(([,v])=>v?.__hi_optional!==true).map(([k])=>k)
  return{description:definition.description,args:{input:{type:'object',properties,required,additionalProperties:false}},execute:(raw:any,ctx:any)=>definition.execute(raw?.input??raw??{},ctx)}
}
export const nativeTool:NativeToolFactory=Object.assign(makeTool,{schema:{string:()=>scalar('string'),number:()=>scalar('number'),boolean:()=>scalar('boolean')}})
