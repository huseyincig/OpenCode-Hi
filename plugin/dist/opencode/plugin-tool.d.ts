export type JsonSchema = Record<string, unknown>;
export type PluginToolDefinition = {
    description: string;
    args?: Record<string, JsonSchema>;
    execute: (args: any, ctx: any) => Promise<any> | any;
};
type HiSchema = JsonSchema & {
    __hi_optional?: true;
    optional: () => HiSchema;
};
interface NativeToolFactory {
    (definition: PluginToolDefinition): PluginToolDefinition;
    schema: {
        string: () => HiSchema;
        number: () => HiSchema;
        boolean: () => HiSchema;
    };
}
export declare const nativeTool: NativeToolFactory;
export {};
