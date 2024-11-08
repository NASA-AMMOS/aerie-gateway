export default {
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
      }
    }
  `,
  CREATE_EXTERNAL_SOURCE_TYPE: `#graphql
    mutation CreateExternalSourceType($sourceType: external_source_type_insert_input!) {
      createExternalSourceType: insert_external_source_type_one(object: $sourceType) {
        name
        attribute_schema
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
