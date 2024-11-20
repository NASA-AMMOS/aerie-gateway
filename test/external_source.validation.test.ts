import Ajv from 'ajv';
import { describe, expect, test } from 'vitest';
import { baseExternalSourceSchema, defsSchema } from '../src/packages/schemas/external-event-validation-schemata';
import { updateSchemaWithDefs } from '../src/packages/external-source/external-source';

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
// const compiledExternalSourceSchema = ajv.compile(externalSourceSchema);

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

  test('verifyDefsCorrect', () => {
    const defs = {
      "$id": "defs",
      "definitions": {
        "event_types": {
          "EventTypeA": {
            "properties": {
              "series": {
                "properties": {
                  "iteration": { "type": "number" },
                  "make": { "type": "string" },
                  "type": { "type": "string" },
                },
                "required": ["type", "make", "iteration"],
                "type": "object",
              }
            },
            "required": ["series"],
            "type": "object",
          },
          "EventTypeB": {
            "type": "object",
            "required": ["projectUser", "tick"],
            "properties": {
              "projectUser": {
                "type": "string"
              },
              "tick": {
                "type": "number"
              }
            }
          },
          "EventTypeC": {
            "type": "object",
            "required": ["aperture", "subduration"],
            "properties": {
              "aperture": {
                "type": "string"
              },
              "subduration": {
                "type": "string",
                "pattern": "^P(?:\\d+Y)?(?:\\d+M)?(?:\\d+D)?T(?:\\d+H)?(?:\\d+M)?(?:\\d+S)?$"
              }
            }
          }
        },
        "source_type": {
          "SourceTypeA": {
            "type": "object",
            "required": ["version", "wrkcat"],
            "properties": {
              "version": {
                "type": "number"
              },
              "wrkcat": {
                "type": "string"
              }
            }
          }
        }
      }
    }

    // missing required for one event type spec
    const badDefs = {
      "$id": "defs",
      "definitions": {
        "event_types": {
          "EventTypeA": {
            "properties": {
              "series": {
                "properties": {
                  "iteration": { "type": "number" },
                  "make": { "type": "string" },
                  "type": { "type": "string" },
                },
                "required": ["type", "make", "iteration"],
                "type": "object",
              }
            },
            "required": ["series"],
            "type": "object",
          },
          "EventTypeB": {
            "type": "object",
            "required": ["projectUser", "tick"],
            "properties": {
              "projectUser": {
                "type": "string"
              },
              "tick": {
                "type": "number"
              }
            }
          },
          "EventTypeC": {
            "type": "object",
            "properties": {
              "aperture": {
                "type": "string"
              },
              "subduration": {
                "type": "string",
                "pattern": "^P(?:\\d+Y)?(?:\\d+M)?(?:\\d+D)?T(?:\\d+H)?(?:\\d+M)?(?:\\d+S)?$"
              }
            }
          }
        },
        "source_type": {
          "SourceTypeA": {
            "type": "object",
            "required": ["version", "wrkcat"],
            "properties": {
              "version": {
                "type": "number"
              },
              "wrkcat": {
                "type": "string"
              }
            }
          }
        }
      }
    };

    // extra source type
    const badDefs2 = {
      "$id": "defs",
      "definitions": {
        "event_types": {
          "EventTypeA": {
            "properties": {
              "series": {
                "properties": {
                  "iteration": { "type": "number" },
                  "make": { "type": "string" },
                  "type": { "type": "string" },
                },
                "required": ["type", "make", "iteration"],
                "type": "object",
              }
            },
            "required": ["series"],
            "type": "object",
          },
          "EventTypeB": {
            "type": "object",
            "required": ["projectUser", "tick"],
            "properties": {
              "projectUser": {
                "type": "string"
              },
              "tick": {
                "type": "number"
              }
            }
          },
          "EventTypeC": {
            "type": "object",
            "required": ["aperture", "subduration"],
            "properties": {
              "aperture": {
                "type": "string"
              },
              "subduration": {
                "type": "string",
                "pattern": "^P(?:\\d+Y)?(?:\\d+M)?(?:\\d+D)?T(?:\\d+H)?(?:\\d+M)?(?:\\d+S)?$"
              }
            }
          }
        },
        "source_type": {
          "SourceTypeA": {
            "type": "object",
            "required": ["version", "wrkcat"],
            "properties": {
              "version": {
                "type": "number"
              },
              "wrkcat": {
                "type": "string"
              }
            }
          },
          "SourceTypeB": {
            "type": "object",
            "required": ["version", "wrkcat"],
            "properties": {
              "version": {
                "type": "number"
              },
              "wrkcat": {
                "type": "string"
              }
            }
          }
        }
      }
    }

    const validator = ajv.compile(defsSchema);
    if(validator !== undefined) {
      let result = validator(defs);
      console.log(result);
      if (!result) {
        console.log(validator.errors)
      }

      result = validator(badDefs);
      console.log(result);
      if (!result) {
        console.log(validator.errors)
      }

      result = validator(badDefs2);
      console.log(result);
      if (!result) {
        console.log(validator.errors)
      }
    }
  })

  test('if statement schema stuff', () => {
    const defs = {
      "$id": "defs",
      "definitions": {
        "event_types": {
          "EventTypeA": {
            "properties": {
              "series": {
                "properties": {
                  "iteration": { "type": "number" },
                  "make": { "type": "string" },
                  "type": { "type": "string" },
                },
                "required": ["type", "make", "iteration"],
                "type": "object",
              }
            },
            "required": ["series"],
            "type": "object",
          },
          "EventTypeB": {
            "type": "object",
            "required": ["projectUser", "tick"],
            "properties": {
              "projectUser": {
                "type": "string"
              },
              "tick": {
                "type": "number"
              }
            }
          },
          "EventTypeC": {
            "type": "object",
            "required": ["aperture", "subduration"],
            "properties": {
              "aperture": {
                "type": "string"
              },
              "subduration": {
                "type": "string",
                "pattern": "^P(?:\\d+Y)?(?:\\d+M)?(?:\\d+D)?T(?:\\d+H)?(?:\\d+M)?(?:\\d+S)?$"
              }
            }
          }
        },
        "source_type": {
          "SourceTypeA": {
            "type": "object",
            "required": ["version", "wrkcat"],
            "properties": {
              "version": {
                "type": "number"
              },
              "wrkcat": {
                "type": "string"
              }
            }
          }
        }
      }
    }

    const result = updateSchemaWithDefs(defs);
    console.log(JSON.stringify(result?.schema));

    // now test it on a source
    const source = {
      "source": {
        "key": "SourceTypeA:valid_source_A.json",
        "source_type_name": "SourceTypeA",
        "valid_at": "2024-001T00:00:00Z",
        "period": {
          "start_time": "2024-001T00:00:00Z",
          "end_time": "2024-007T00:00:00Z"
        },
        "attributes": {
          "version": 1,
          "wrkcat": "234"
        }
      },
      "external_events": [
        {
          "key": "EventTypeA:1/1",
          "event_type_name": "EventTypeA",
          "start_time": "2024-001T01:35:00Z",
          "duration": "02:00:00",
          "attributes": {
            "series": {
              "type": "A",
              "make": "alpha",
              "iteration": 17
            }
          }
        },
        {
          "key": "EventTypeA:1/2",
          "event_type_name": "EventTypeA",
          "start_time": "2024-002T11:50:00Z",
          "duration": "02:00:00",
          "attributes": {
            "series": {
              "type": "B",
              "make": "beta",
              "iteration": 21
            }
          }
        },
        {
          "key": "EventTypeB:1/3",
          "event_type_name": "EventTypeB",
          "start_time": "2024-003T15:20:00Z",
          "duration": "03:40:00",
          "attributes": {
            "projectUser": "Jerry",
            "tick": 18
          }
        }
      ]
    }

    const badSource = {
      "source": {
        "key": "SourceTypeA:valid_source_A.json",
        "source_type_name": "SourceTypeA",
        "valid_at": "2024-001T00:00:00Z",
        "period": {
          "start_time": "2024-001T00:00:00Z",
          "end_time": "2024-007T00:00:00Z"
        },
        "attributes": {
          "version": 1,
          "wrkcat": "234"
        }
      },
      "external_events": [
        {
          "key": "EventTypeA:1/1",
          "event_type_name": "EventTypeA",
          "start_time": "2024-001T01:35:00Z",
          "duration": "02:00:00",
          "attributes": {
            "series": {
              "type": "A",
              "bake": "alpha",
              "iteration": "17" // fails here!
            }
          }
        },
        {
          "key": "EventTypeA:1/2",
          "event_type_name": "EventTypeA",
          "start_time": "2024-002T11:50:00Z",
          "duration": "02:00:00",
          "attributes": {
            "series": {
              "type": "B",
              "make": "beta",
              "iteration": 21
            }
          }
        },
        {
          "key": "EventTypeB:1/3",
          "event_type_name": "EventTypeB",
          "start_time": "2024-003T15:20:00Z",
          "duration": "03:40:00",
          "attributes": {
            "projectUser": "Jerry",
            "tick": 18
          }
        }
      ]
    };

    if(result !== undefined) {
      let validated = result(source);
      console.log(validated);
      if (!validated) {
        console.log(result.errors)
      }

      validated = result(badSource);
      console.log(validated);
      if (!validated) {
        console.log(result.errors)
      }
    }
  });






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
  // describe('external source validation', () => {
  //   test('correct external source validation', async () => {
  //     let sourceIsValid: boolean = false;
  //     sourceIsValid = await compiledExternalSourceSchema(externalSource);
  //     expect(sourceIsValid).toBe(true);
  //   });
  // });

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
