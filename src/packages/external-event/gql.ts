export default {
  CREATE_EXTERNAL_EVENT_TYPE: `#graphql
    mutation CreateExternalEventType($eventType: external_event_type_insert_input!)
    {
      createExternalEventType: insert_external_event_type_one(object: $eventType) {
        attribute_schema
        name
      }
    }
  `
}
