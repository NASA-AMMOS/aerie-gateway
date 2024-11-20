// TODO: Discuss external event/source type schemas. Do we want to validate these with a (meta)schema too? Or just allow any plain JSON Schema?
//          Currently, we do the latter but the former doesn't seem like a bad idea!
//          The main argument against the former is what we have works and introducing new schemas could be a rabbit hole.

// export const externalEventTypeSchema = {
//     additionalProperties: false,
//     properties: {
//         entries: {
//             items: {
//                 additionalProperties: false,
//                 properties: {
//                     metadata: {
//                         items: {
//                             additionalProperties: false,
//                             properties: {
//                                 isRequired: { type: 'boolean' },
//                                 name: { type: 'string' },
//                                 schema: {
//                                     additionalProperties: false,
//                                     properties: { type: { type: 'string' } },
//                                     required: ['type'],
//                                     type: 'object',
//                                 },
//                             },
//                             required: ['name', 'isRequired', 'schema'],
//                             type: 'object',
//                         },
//                         type: 'array',
//                     },
//                     name: { type: 'string' },
//                 },
//                 required: ['name', 'metadata'],
//                 type: 'object',
//             },
//             type: 'array',
//         },
//     },
//     required: ['entries'],
//     type: 'object',
// };
// export const externalSourceTypeSchema = {
//     additionalProperties: false,
//     properties: {
//         entries: {
//             items: {
//                 additionalProperties: false,
//                 properties: {
//                     metadata: {
//                         items: {
//                             additionalProperties: false,
//                             properties: {
//                                 isRequired: { type: 'boolean' },
//                                 name: { type: 'string' },
//                                 schema: {
//                                     additionalProperties: false,
//                                     properties: { type: { type: 'string' } },
//                                     required: ['type'],
//                                     type: 'object',
//                                 },
//                             },
//                             required: ['name', 'isRequired', 'schema'],
//                             type: 'object',
//                         },
//                         type: 'array',
//                     },
//                     name: { type: 'string' },
//                 },
//                 required: ['name', 'metadata'],
//                 type: 'object',
//             },
//             type: 'array',
//         },
//     },
//     required: ['entries'],
//     type: 'object',
// };

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
