export type JsonSchema = Record<string, unknown>;
export type PluginToolDefinition = {
    description: string;
    args?: Record<string, JsonSchema>;
    execute: (args: any, ctx: any) => Promise<any> | any;
};
type HhcSchema = JsonSchema & {
    __hhc_optional?: true;
    optional: () => HhcSchema;
};
interface NativeToolFactory {
    (definition: PluginToolDefinition): PluginToolDefinition;
    schema: {
        string: () => HhcSchema;
        number: () => HhcSchema;
        boolean: () => HhcSchema;
    };
}
export declare const nativeTool: NativeToolFactory;
export {};
