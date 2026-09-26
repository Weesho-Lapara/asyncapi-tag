/** Short labels for schema formats, for the "contentType · format" line (design: "JSON Schema"). */
export function schemaFormatLabel(schemaFormat: string): string {
  const f = schemaFormat.toLowerCase();
  if (f.includes('avro')) return 'Avro';
  if (f.includes('protobuf')) return 'Protobuf';
  if (f.includes('raml')) return 'RAML';
  if (f.includes('openapi')) return 'OpenAPI Schema';
  if (f.includes('vnd.aai.asyncapi') || f.includes('json-schema') || f.includes('schema+json') || f.includes('schema+yaml')) return 'JSON Schema';
  return schemaFormat;
}
