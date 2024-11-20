export const defsSchema = {
    "$defs": {
        "AttributeSchema": {
            "additionalProperties": false,
            "patternProperties": {
                "^.*$": {
                    "properties": {
                        "properties": { "type": "object" },
                        "required": {
                            "items": { "type": "string" },
                            "type": "array"
                        },
                        "type": { "type": "string" },
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
    "description": "Schema for defs objects for a given source type.",
    "properties": {
        "$id": { "type": "string" },
        "definitions": {
            "additionalProperties": false,
            "properties": {
                "event_types": {
                    "$ref": "#/$defs/AttributeSchema"
                },
                "source_type": {
                    "allOf": [
                        {
                            "$ref": "#/$defs/AttributeSchema"
                        },
                        {
                            "maxProperties": 1
                        }
                    ]
                }
            },
            "required": ["event_types", "source_type"],
            "type": "object"
        }
    },
    "type": "object"
};

export const baseExternalSourceSchema: { [key: string]: any } = {
    $id: "source_schema",
    $schema: "http://json-schema.org/draft-07/schema",
    additionalProperties: false,
    description: "The base schema for external sources. Defs and ifs, for specific source/event type attributes, are integrated later.",
    properties: {
        external_events: {
            items: {
                additionalProperties: false,
                properties: {
                    attributes: {
                        type: "object"
                    },
                    duration: { "type": "string" },
                    event_type_name: { "type": "string" },
                    key: { "type": "string" },
                    start_time: { "type": "string" }
                },
                required: ["duration", "event_type_name", "key", "attributes", "start_time"],
                type: "object"
            },
            type: "array"
        },
        source: {
            additionalProperties: false,
            properties: {
                attributes: {
                    type: "object" // WILL BE REPLACED WITH A $ref
                },
                derivation_group_name: { "type": "string" },
                key: { "type": "string" },
                period: {
                    additionalProperties: false,
                    properties: {
                        end_time: {
                            pattern: "^(\\d){4}-([0-3][0-9])-([0-9][0-9])T([0-1][0-9]):([0-5][0-9]):([0-5][0-9])(\\+|-)([0-1][0-9]):([0-5][0-9])$",
                            type: "string"
                        },
                        start_time: {
                            pattern: "^(\\d){4}-([0-3][0-9])-([0-9][0-9])T([0-1][0-9]):([0-5][0-9]):([0-5][0-9])(\\+|-)([0-1][0-9]):([0-5][0-9])$",
                            type: "string"
                        }
                    },
                    required: ["start_time", "end_time"],
                    type: "object"
                },
                source_type_name: { "type": "string" },
                valid_at: {
                    pattern: "^(\\d){4}-([0-3][0-9])-([0-9][0-9])T([0-1][0-9]):([0-5][0-9]):([0-5][0-9])(\\+|-)([0-1][0-9]):([0-5][0-9])$",
                    type: "string"
                }
            },
            required: ["key", "source_type_name", "valid_at", "period", "attributes"],
            type: "object"
        }
    },
    required: ["source", "external_events"],
    title: "SourceTypeA",
    type: "object"
}