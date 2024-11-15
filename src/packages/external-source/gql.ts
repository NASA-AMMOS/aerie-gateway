export default { // TODO: discuss upset for derivation group
  CREATE_EXTERNAL_SOURCE: `#graphql
    mutation CreateExternalSource(
      $derivation_group: derivation_group_insert_input!,
      $source: external_source_insert_input!,
    ) {
      upsertDerivationGroup: insert_derivation_group_one (
        object: $derivation_group,
        on_conflict: {
          constraint: derivation_group_pkey
        }
      ) {
        name
      }
      createExternalSource: insert_external_source_one (
        object: $source
      ) {
        derivation_group_name,
        end_time,
        key,
        source_type_name,
        start_time,
        valid_at,
        attributes
      }
    }
  `,
  CREATE_EXTERNAL_SOURCE_TYPE: `#graphql
    mutation CreateExternalSourceType($sourceType: external_source_type_insert_input!, $allowedTypes: [external_source_type_allowed_event_types_insert_input!]!) {
      createExternalSourceType: insert_external_source_type_one(object: $sourceType) {
        name
        attribute_schema
      }
      defineAllowedTypes: insert_external_source_type_allowed_event_types(objects: $allowedTypes) {
        returning {
          external_source_type
          external_event_type
        }
      }
    }
  `,
  GET_EXTERNAL_EVENT_TYPES: `#graphql
    query ExistingEventTypes {
      existingEventTypes: external_event_type {
        name
      }
    }
  `,
  GET_EXTERNAL_EVENT_TYPES_FOR_SOURCE_TYPE: `#graphql
    query ExistingEventTypesForSourceType($sourceType: String!) {
      existingEventTypes: external_source_type_allowed_event_types(where: {external_source_type: {_eq: $sourceType}}) {
        external_event_type
      }
    }
  `,
  GET_EXTERNAL_EVENT_TYPE_ATTRIBUTE_SCHEMA: `#graphql
  query GetExternalEventTypeAttributeSchema($name: String!) {
    external_event_type_by_pk(name: $name) {
      attribute_schema
    }
  }
  `,
  GET_EXTERNAL_SOURCE_TYPE_ATTRIBUTE_SCHEMA: `#graphql
    query GetExternalSourceTypeAttributeSchema($name: String!) {
      external_source_type_by_pk(name: $name) {
        attribute_schema
      }
    }
  `
}
