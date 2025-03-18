import Ajv from 'ajv';
import { describe, expect, test } from 'vitest';
import { attributeSchemaMetaschema } from '../src/schemas/external-event-validation-schemata';
import { updateSchemaWithDefs } from '../src/packages/external-source/external-source';

const ajv = Ajv();

const attributeDefs = {
  event_types: {
    EventTypeA: {
      properties: {
        series: {
          properties: {
            iteration: { type: 'number' },
            make: { type: 'string' },
            type: { type: 'string' },
          },
          required: ['type', 'make', 'iteration'],
          type: 'object',
        },
      },
      required: ['series'],
      type: 'object',
    },
    EventTypeB: {
      properties: {
        projectUser: {
          type: 'string',
        },
        tick: {
          type: 'number',
        },
      },
      required: ['projectUser', 'tick'],
      type: 'object',
    },
    EventTypeC: {
      properties: {
        aperture: {
          type: 'string',
        },
        subduration: {
          pattern: '^P(?:\\d+Y)?(?:\\d+M)?(?:\\d+D)?T(?:\\d+H)?(?:\\d+M)?(?:\\d+S)?$',
          type: 'string',
        },
      },
      required: ['aperture', 'subduration'],
      type: 'object',
    },
  },
  source_types: {
    SourceTypeA: {
      properties: {
        version: {
          type: 'number',
        },
        wrkcat: {
          type: 'string',
        },
      },
      required: ['version', 'wrkcat'],
      type: 'object',
    },
    SourceTypeB: {
      properties: {
        version: {
          type: 'number',
        },
        wrkcat: {
          type: 'string',
        },
      },
      required: ['version', 'wrkcat'],
      type: 'object',
    },
  },
};

const incorrectAttributeDefs = {
  event_types: {
    EventTypeA: {
      properties: {
        series: {
          properties: {
            iteration: { type: 'number' },
            make: { type: 'string' },
            type: { type: 'string' },
          },
          // "required": ["type", "make", "iteration"], // missing required field (not an issue)
          type: 'object',
        },
      },
      // "required": ["series"], // missing required field (the issue, only at level patternProperties/sdfdsf/required)
      type: 'object',
    },
    EventTypeB: attributeDefs.event_types.EventTypeB,
    EventTypeC: attributeDefs.event_types.EventTypeC,
  },
  source_types: attributeDefs.source_types,
};

const correctExternalSource = {
  events: [
    {
      attributes: {
        series: {
          iteration: 17,
          make: 'alpha',
          type: 'A',
        },
      },
      duration: '02:00:00',
      event_type_name: 'EventTypeA',
      key: 'EventTypeA:1/1',
      start_time: '2024-01-01T01:35:00+00:00',
    },
    {
      attributes: {
        series: {
          iteration: 21,
          make: 'beta',
          type: 'B',
        },
      },
      duration: '02:00:00',
      event_type_name: 'EventTypeA',
      key: 'EventTypeA:1/2',
      start_time: '2024-01-02T11:50:00+00:00',
    },
    {
      attributes: {
        projectUser: 'Jerry',
        tick: 18,
      },
      duration: '03:40:00',
      event_type_name: 'EventTypeB',
      key: 'EventTypeB:1/3',
      start_time: '2024-01-03T15:20:00+00:00',
    },
  ],
  source: {
    attributes: {
      version: 1,
      wrkcat: '234',
    },
    key: 'SourceTypeA:valid_source_A.json',
    period: {
      end_time: '2024-01-07T00:00:00+00:00',
      start_time: '2024-01-01T00:00:00+00:00',
    },
    source_type_name: 'SourceTypeA',
    valid_at: '2024-01-01T00:00:00+00:00',
  },
};

const incorrectExternalSourceAttributes = {
  events: correctExternalSource.events,
  source: {
    ...correctExternalSource.source,
    attributes: {
      version: 1,
      wrkcat: 234, // <-- wrong type. expecting string.
    },
  },
};

const incorrectExternalEventAttributes = {
  events: [
    {
      ...correctExternalSource.events[0],
      attributes: {
        series: {
          iteration: 17,
          make: 'alpha',
          // "type": "A", <-- missing.
        },
      },
    },
    {
      ...correctExternalSource.events[1],
    },
    {
      ...correctExternalSource.events[2],
    },
  ],
  source: correctExternalSource.source,
};

describe('validation tests', () => {
  // test to verify source/event type file is correctly formatted
  test('verify source/event type file is correctly formatted', () => {
    // get the validator
    const attributeValidator = ajv.compile(attributeSchemaMetaschema);

    // test it against a correct defs/attribute metaschema object
    const result = attributeValidator(attributeDefs);
    expect(result).toBeTruthy();
    expect(attributeValidator.errors).toBeNull();
  });

  // test to verify source/event type file is incorrectly formatted
  test('verify source/event type file is incorrectly formatted', () => {
    // get the validator
    const attributeValidator = ajv.compile(attributeSchemaMetaschema);

    // test it against a correct defs/attribute metaschema object
    const result = attributeValidator(incorrectAttributeDefs);
    expect(result).toBeFalsy();

    const errors = attributeValidator.errors;
    expect(errors?.length).toBe(1);
    expect(errors?.at(0)?.schemaPath).toBe('#/$defs/AttributeSchema/patternProperties/%5E.*%24/required');
    expect(errors?.at(0)?.message).toMatch("should have required property 'required'");
  });

  // test to verify that composition of a base schema with attribute schemas work
  test('verify validation functionality of updateSchemaWithDefs', () => {
    // transform attributeDefs to match something that might come from hasura (just ONE source type, as we will be constructing a schema for a specific source)
    const attributeSchema: { event_types: any; source_type: any } = {
      event_types: [],
      source_type: {},
    };
    attributeSchema.event_types = attributeDefs.event_types;
    attributeSchema.source_type['SourceTypeA'] = attributeDefs.source_types.SourceTypeA;

    // construct a megaschema
    const schemaFunctionWithDefs = updateSchemaWithDefs(attributeSchema);
    const schema: any = schemaFunctionWithDefs.schema;
    expect(schema).toBeTruthy();

    if (schema) {
      // verify it is formatted correctly
      expect(Object.keys(schema.$defs.event_types)).toMatchObject(['EventTypeA', 'EventTypeB', 'EventTypeC']);
      expect(Object.keys(schema.$defs.source_type)).toMatchObject(['SourceTypeA']);
      expect(schema.properties.events.items.else.else.properties.attributes.$ref).toEqual(
        '#/$defs/event_types/EventTypeC',
      );
    }
  });

  // source testing
  describe('validating (and failing) sources', () => {
    // transform attributeDefs to match something that might come from hasura (just ONE source type, as we will be constructing a schema for a specific source)
    const attributeSchema: { event_types: any; source_type: any } = {
      event_types: [],
      source_type: {},
    };
    attributeSchema.event_types = attributeDefs.event_types;
    attributeSchema.source_type['SourceTypeA'] = attributeDefs.source_types.SourceTypeA;

    // construct a megaschema
    const schemaFunctionWithDefs = updateSchemaWithDefs(attributeSchema);

    // test to verify a source's (and all events') attributes are correctly formatted
    test('source and event attributes are correct', () => {
      const result = schemaFunctionWithDefs(correctExternalSource);
      expect(result).toBeTruthy();
      expect(schemaFunctionWithDefs.errors).toBeNull();
    });

    // test to verify a source's attributes are incorrectly formatted
    test('source attributes fail when incorrectly formatted', () => {
      const result = schemaFunctionWithDefs(incorrectExternalSourceAttributes);
      expect(result).toBeFalsy();

      const errors = schemaFunctionWithDefs.errors;
      expect(errors?.length).toBe(1);
      expect(errors?.at(0)?.schemaPath).toBe('#/$defs/source_type/SourceTypeA/properties/wrkcat/type');
      expect(errors?.at(0)?.message).toMatch('should be string');
    });

    // test to verify an event's attributes are incorrectly formatted
    test('event attributes fail when incorrectly formatted', () => {
      const result = schemaFunctionWithDefs(incorrectExternalEventAttributes);
      expect(result).toBeFalsy();

      const errors = schemaFunctionWithDefs.errors;
      expect(errors?.length).toBe(1);
      expect(errors?.at(0)?.schemaPath).toBe('#/$defs/event_types/EventTypeA/properties/series/required');
      expect(errors?.at(0)?.message).toMatch("should have required property 'type'");
    });
  });
});
