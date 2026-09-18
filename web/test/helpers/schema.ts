import { readFileSync } from 'node:fs';
import Ajv2020, { type ValidateFunction } from 'ajv/dist/2020';
import addFormats from 'ajv-formats';

export function loadSchema(name: string): object {
  return JSON.parse(readFileSync(new URL(`../../public/schema/${name}`, import.meta.url), 'utf8')) as object;
}

export interface CompiledSchema {
  schema: object & { $id: string };
  validate: ValidateFunction;
  subschema(pointer: string): ValidateFunction;
}

export function compileSchema(name: string): CompiledSchema {
  const schema = loadSchema(name) as object & { $id: string };
  const ajv = new Ajv2020({ allErrors: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  return {
    schema,
    validate,
    subschema(pointer) {
      const compiled = ajv.getSchema(`${schema.$id}${pointer}`);
      if (!compiled) throw new Error(`no subschema at ${pointer}`);
      return compiled;
    },
  };
}

export function schemaErrors(validate: ValidateFunction, value: unknown): string[] {
  validate(value);
  return (validate.errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message}`);
}
