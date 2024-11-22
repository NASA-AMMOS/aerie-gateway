export type DerivationGroupInsertInput = {
  name: string;
  source_type_name: string;
};

export type ExternalSourceTypeInsertInput = {
  name: string;
  attribute_schema: object;
};


export type ExternalEventTypeInsertInput = {
  name: string;
  attribute_schema: object;
};

export type ExternalSourceInsertInput = {
  attributes: object;
  derivation_group_name: string;
  end_time: string;
  external_events: {
    data: {
      start_time: string;
      duration: string;
      event_type_name: string;
      key: string;
    }[];
  };
  key: string;
  source_type_name: string;
  start_time: string;
  valid_at: string;
};

export type UploadExternalSourceJSON = {
  events: ExternalEventJson[];
  source: {
    attributes: object;
    key: string;
    period: {
      end_time: string;
      start_time: string;
    };
    source_type: string;
    valid_at: string;
  };
};

export type CreateExternalSourceResponse = {
  createExternalSource: { name: string };
};

export type CreateExternalSourceEventTypeResponse = {
  createExternalEventTypes: { returning: string[] },
  createExternalSourceTypes: { returning: string[] }
};

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

export type ExternalEvent = {
  key: string;
  event_type_name: string;
  start_time: string;
  duration: string;
  attributes: object;
};

export type AttributeSchema = {
  [x: string]: any;
};

export type GetSourceEventTypeAttributeSchemasResponse = {
  external_event_type: ExternalEventTypeInsertInput[],
  external_source_type: ExternalSourceTypeInsertInput[],
}
