export type ExternalEventInsertInput = {
  attributes: object;
  start_time: string;
  duration: string;
  event_type_name: string;
  key: string;
};

export type ExternalEventJson = {
  attributes: object;
  duration: string;
  event_type: string;
  key: string;
  start_time: string;
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

export type CreateExternalEventTypeResponse = {
  createExternalEventType: { attribute_schema: object; name: string };
};

export type UploadAttributeJSON = {
  [x: string]: any;
};
