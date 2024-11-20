export type ExternalEventInsertInput = {
  attributes: object;
  start_time: string;
  duration: string;
  event_type_name: string;
  key: string;
};

export type ExternalEventTypeInsertInput = {
  name: string;
  attribute_schema: object;
};

export type ExternalEvent = {
  key: string;
  event_type_name: string;
  start_time: string;
  duration: string;
  attributes: object;
};
