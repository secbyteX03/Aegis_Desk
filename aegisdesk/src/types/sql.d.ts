// Type declarations for sql template tag
declare module "sql-template-tag" {
    export function sql(strings: TemplateStringsArray, ...values: any[]): any[];
    export const sql: {
        (strings: TemplateStringsArray, ...values: any[]): any[];
    };
}
