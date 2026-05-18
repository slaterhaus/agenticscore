import yaml from "js-yaml";

// Minimal OpenAPI types — avoids pulling in openapi-types as a dependency
type OpenAPIDocument = Record<string, any>;
type ParameterObject = Record<string, any>;
type RequestBodyObject = Record<string, any>;
type ResponseObject = Record<string, any>;

export interface ParsedSpec {
  raw: OpenAPIDocument;
  operations: OperationEntry[];
  schemas: SchemaEntry[];
  metadata: SpecMetadata;
}

export interface OperationEntry {
  path: string;
  method: string;
  operationId?: string;
  summary?: string;
  description?: string;
  parameters: ParameterObject[];
  requestBody?: RequestBodyObject;
  responses: Record<string, ResponseObject>;
  tags: string[];
  hasExamples: boolean;
}

export interface SchemaEntry {
  name: string;
  schema: Record<string, any>;
  hasDescription: boolean;
  hasExamples: boolean;
  propertyCount: number;
}

export interface SpecMetadata {
  title: string;
  version: string;
  operationCount: number;
  schemaCount: number;
  hasContact: boolean;
  hasLicense: boolean;
  hasTags: boolean;
}

/**
 * Parse an OpenAPI spec (YAML or JSON) into a structured format for scoring.
 */
export function scanSpec(input: string): ParsedSpec {
  const raw = (input.trim().startsWith("{") ? JSON.parse(input) : yaml.load(input)) as OpenAPIDocument;

  const operations: OperationEntry[] = [];
  const paths = raw.paths || {};

  for (const [path, pathItem] of Object.entries(paths)) {
    if (!pathItem) continue;
    const pathObj = pathItem as Record<string, any>;

    for (const method of ["get", "post", "put", "patch", "delete"] as const) {
      const op = pathObj[method] as Record<string, any> | undefined;
      if (!op) continue;

      const parameters = [
        ...((pathObj.parameters as ParameterObject[]) || []),
        ...((op.parameters as ParameterObject[]) || []),
      ];

      const responses: Record<string, ResponseObject> = {};
      for (const [code, resp] of Object.entries(op.responses || {})) {
        responses[code] = resp as ResponseObject;
      }

      const hasExamples = checkForExamples(op, responses);

      operations.push({
        path,
        method,
        operationId: op.operationId,
        summary: op.summary,
        description: op.description,
        parameters,
        requestBody: op.requestBody as RequestBodyObject | undefined,
        responses,
        tags: op.tags || [],
        hasExamples,
      });
    }
  }

  const schemas: SchemaEntry[] = [];
  const components = raw.components?.schemas || {};
  for (const [name, schema] of Object.entries(components)) {
    const s = schema as Record<string, any>;
    schemas.push({
      name,
      schema: s,
      hasDescription: !!s.description,
      hasExamples: s.example !== undefined || s.examples !== undefined,
      propertyCount: Object.keys(s.properties || {}).length,
    });
  }

  return {
    raw,
    operations,
    schemas,
    metadata: {
      title: raw.info?.title || "Untitled",
      version: raw.info?.version || "0.0.0",
      operationCount: operations.length,
      schemaCount: schemas.length,
      hasContact: !!raw.info?.contact,
      hasLicense: !!raw.info?.license,
      hasTags: (raw.tags?.length || 0) > 0,
    },
  };
}

function checkForExamples(op: Record<string, any>, responses: Record<string, ResponseObject>): boolean {
  // Check request body examples
  const reqBody = op.requestBody as RequestBodyObject | undefined;
  if (reqBody?.content) {
    for (const media of Object.values(reqBody.content) as any[]) {
      if (media.example || media.examples) return true;
    }
  }

  // Check response examples
  for (const resp of Object.values(responses)) {
    if ((resp as any).content) {
      for (const media of Object.values((resp as any).content) as any[]) {
        if (media.example || media.examples) return true;
      }
    }
  }

  return false;
}
