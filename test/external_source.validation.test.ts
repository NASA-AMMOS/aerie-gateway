import Ajv from 'ajv';
import { describe, expect, test } from 'vitest';
import { externalSourceSchema } from '../src/packages/schemas/external-event-validation-schemata';

const ajv = Ajv();

// type schemas
const correctExternalEventTypeSchema = {
  $schema: "http://json-schema.org/draft-07/schema",
  additionalProperties: false,
  description: "Schema for the attributes of the TestEventType Type.",
  properties: {
    code: { type: "string" },
    projectUser: { type: "string" }
  },
  required: ["projectUser", "code"],
  title: "TestEventType",
  type: "object",
}

const incorrectPassingExternalEventTypeSchema = {
  $schema: "http://json-schema.org/draft-07/schema",
  additionalProperties: false,
  descriptionFake: "Schema for the attributes of the TestEventType Type.",
  doesntEvenExist: true,
  propertgibberish: { // if you have something like this, it just registers as no properties existing, and fails any inserted events with attributes.
    code: { type: "string" },
    projectUser: { type: "string" }
  },
  requiredgibberish: ["projectUser", "code"],
  title: "TestEventType",
  type: "object",
}

const incorrectFailingExternalEventTypeSchema = {
  $schema: "http://json-schema.org/draft-07/schema",
  additionalProperties: false,
  description: "Schema for the attributes of the TestEventType Type.",
  properties: {
    code: { type: "string" },
    projectUser: { type: "string" }
  },
  required: 123, // this fails to validate at all since "required" IS well-defined as a field but expects an array
  title: "TestEventType",
  type: "object",
}

const externalSourceTypeSchema = {
  $schema: "http://json-schema.org/draft-07/schema",
  additionalProperties: false,
  description: "Schema for the attributes of the TestSourceType Type.",
  properties: {
    operator: { type: "string" },
    version: { type: "number" }
  },
  required: ["version", "operator"],
  title: "TestSourceType",
  type: "object"
};

// compiled schemas
const compiledExternalEventTypeSchema = ajv.compile(correctExternalEventTypeSchema);
const compiledExternalSourceTypeSchema = ajv.compile(externalSourceTypeSchema);
const compiledExternalSourceSchema = ajv.compile(externalSourceSchema);

// external source
const externalSource = {
  external_events: [
    {
      attributes: {
        "code": "A",
        "projectUser": "UserA"
      },
      duration: '01:10:00',
      event_type_name: 'TestExternalEventType',
      key: 'Event01',
      start_time: '2024-023T00:23:00Z'
    },
    {
      attributes: {
        "code": "B",
        "projectUser": "UserB"
      },
      duration: '03:40:00',
      event_type_name: 'DSNContact',
      key: 'Event02',
      start_time: '2024-021T00:21:00Z'
    }
  ],
  source: {
    attributes: { 
      operator: 'alpha',
      version: 1
    },
    derivation_group_name: 'TestDerivationGroup',
    key: 'TestExternalSourceKey',
    period: {
      end_time: '2024-01-28T00:00:00+00:00',
      start_time: '2024-01-21T00:00:00+00:00'
    },
    source_type_name: 'TestExternalSourceType',
    valid_at: '2024-01-19T00:00:00+00:00'
  }
}; 

// invalid attributes
const invalidSourceAttributes = {
  operator: 1,
  version: 1
}
const invalidEventAttributes = {
  code: 1,
  projectUser: "UserB"
}


describe('validation tests', () => {
  
  // test validating type schema validation (demonstrate you can feed it bogus and its fine, but if an existing field gets a wrong type then its a problem)
  describe('attribute schema validation', () => {
    test('validating correct external event type schema', () => {
      const schemaIsValid: boolean = ajv.validateSchema(correctExternalEventTypeSchema);
      expect(schemaIsValid).toBe(true);
    });

    test('validating incorrect external event type schema that passes', () => {
      const schemaIsValid: boolean = ajv.validateSchema(incorrectPassingExternalEventTypeSchema);
      expect(schemaIsValid).toBe(true);
    });

    test('validating incorrect external event type schema that fails', () => {
      const schemaIsValid: boolean = ajv.validateSchema(incorrectFailingExternalEventTypeSchema);
      expect(schemaIsValid).toBe(false);
      const errors = ajv.errors;
      expect(errors?.length).toBe(1);
      expect(errors?.at(0)?.message).toContain('should be array')
    });
  });

  // test validating external source validation - don't need to be thorough; this is just ajv functionality.
  describe('external source validation', () => {
    test('correct external source validation', async () => {
      let sourceIsValid: boolean = false;
      sourceIsValid = await compiledExternalSourceSchema(externalSource);
      expect(sourceIsValid).toBe(true);
    });
  });

  // test validating external source attribute validation
  describe('external source type attribute validation', () => {
    test('correct external source type attribute validation', async () => {
      let sourceAttributesAreValid: boolean = false;
      sourceAttributesAreValid = await compiledExternalSourceTypeSchema(externalSource.source.attributes);
      expect(sourceAttributesAreValid).toBe(true);
    });

    test('incorrect external source type attribute validation', async () => {
      let sourceAttributesAreValid: boolean = false;
      sourceAttributesAreValid = await compiledExternalSourceTypeSchema(invalidSourceAttributes);
      expect(sourceAttributesAreValid).toBe(false);
      const errors = compiledExternalSourceTypeSchema.errors;
      expect(errors?.length).toBe(1);
      expect(errors?.at(0)?.message).toContain('should be string');
    });
  });

  // test validating external event attribute validation
  describe('external event type attribute validation', () => {
    test('correct external event type attribute validation', async () => {
      let eventAttributesAreValid: boolean = true;
      for (const external_event of externalSource.external_events) {
        eventAttributesAreValid = eventAttributesAreValid && await compiledExternalEventTypeSchema(external_event.attributes);
      }
      expect(eventAttributesAreValid).toBe(true);
    });

    test('incorrect external event type attribute validation', async () => {
      let eventAttributesAreValid: boolean = false;
      eventAttributesAreValid = await compiledExternalEventTypeSchema(invalidEventAttributes);
      expect(eventAttributesAreValid).toBe(false);
      const errors = compiledExternalEventTypeSchema.errors;
      expect(errors?.length).toBe(1);
      expect(errors?.at(0)?.message).toContain('should be string');
    });
  });
});
