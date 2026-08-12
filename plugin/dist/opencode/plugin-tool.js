function scalar(type, isOptional = false) {
    const base = { type };
    if (isOptional)
        base.__hi_optional = true;
    base.optional = () => scalar(type, true);
    return base;
}
function clean(schema) { const { __hi_optional: _, optional: __, ...rest } = schema; return rest; }
const makeTool = (definition) => {
    const args = definition.args ?? {}, entries = Object.entries(args);
    if (!entries.some(([, schema]) => schema?.__hi_optional === true))
        return { ...definition, args: Object.fromEntries(entries.map(([k, v]) => [k, clean(v)])) };
    const properties = Object.fromEntries(entries.map(([k, v]) => [k, clean(v)])), required = entries.filter(([, v]) => v?.__hi_optional !== true).map(([k]) => k);
    return { description: definition.description, args: { input: { type: 'object', properties, required, additionalProperties: false } }, execute: (raw, ctx) => definition.execute(raw?.input ?? raw ?? {}, ctx) };
};
export const nativeTool = Object.assign(makeTool, { schema: { string: () => scalar('string'), number: () => scalar('number'), boolean: () => scalar('boolean') } });
