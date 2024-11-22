// a schema that describes the format for the attribute files (which are, themselves, JSON Schema-like)
export const attributeSchemaMetaschema = {
    "$defs": {
        "AttributeSchema": {
            "additionalProperties": false,
            "patternProperties": {
                "^.*$": {
                    "properties": {
                        "properties": {
                            "additionalProperties": true,
                            "type": "object"
                        },
                        "required": {
                            "items": { "type": "string" },
                            "type": "array"
                        },
                        "type": { "type": "string" }
                    },
                    "required": ["required", "properties", "type"],
                    "type": "object"
                }
            },
            "type": "object"
        }
    },
    "$schema": "http://json-schema.org/draft-07/schema",
    "additionalProperties": false,
    "description": "Schema for the attributes of uploaded source types and/or event types.",
    "properties": {
        "event_types": {
            "$ref": "#/$defs/AttributeSchema"
        },
        "source_types": {
            "$ref": "#/$defs/AttributeSchema"
        }
    },
    "required": ["source_types", "event_types"],
    "title": "TypeSpecificationSchema",
    "type": "object"
}

// the schema that schemas for specific types are integrated with, after pulling them from the database
export const externalSourceSchema = {
    additionalProperties: false,
    properties: {
        external_events: {
            items: {
                additionalProperties: false,
                properties: {
                    attributes: {
                        additionalProperties: true,
                        properties: {},
                        required: [],
                        type: 'object',
                    },
                    duration: { type: 'string' },
                    event_type_name: { type: 'string' },
                    key: { type: 'string' },
                    start_time: { type: 'string' },
                },
                required: ['duration', 'event_type_name', 'key', 'attributes', 'start_time'],
                type: 'object',
            },
            type: 'array',
        },
        source: {
            additionalProperties: false,
            properties: {
                attributes: {
                    additionalProperties: true,
                    properties: {}, // constrained by type, checked by DB trigger on upload. TODO: CHECK LOCALLY?
                    required: [],
                    type: 'object',
                },
                derivation_group_name: { type: 'string' },
                key: { type: 'string' },
                period: {
                    additionalProperties: false,
                    properties: {
                        end_time: {
                            pattern:
                                '^(\\d){4}-([0-3][0-9])-([0-9][0-9])T([0-1][0-9]):([0-5][0-9]):([0-5][0-9])(\\+|-)([0-1][0-9]):([0-5][0-9])$',
                            type: 'string',
                        },
                        start_time: {
                            pattern:
                                '^(\\d){4}-([0-3][0-9])-([0-9][0-9])T([0-1][0-9]):([0-5][0-9]):([0-5][0-9])(\\+|-)([0-1][0-9]):([0-5][0-9])$',
                            type: 'string',
                        },
                    },
                    required: ['start_time', 'end_time'],
                    type: 'object',
                },
                source_type_name: { type: 'string' },
                valid_at: {
                    pattern:
                        '^(\\d){4}-([0-3][0-9])-([0-9][0-9])T([0-1][0-9]):([0-5][0-9]):([0-5][0-9])(\\+|-)([0-1][0-9]):([0-5][0-9])$',
                    type: 'string',
                },
            },
            required: ['key', 'source_type_name', 'valid_at', 'period', 'attributes'],
            type: 'object',
        },
    },
    required: ['source', 'external_events'],
    type: 'object',
};
