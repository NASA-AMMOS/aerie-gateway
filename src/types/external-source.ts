import { ExternalEventJson } from './external-event';

export type DerivationGroupInsertInput = {
  name: string;
  source_type_name: string;
};

export type ExternalSourceTypeInsertInput = {
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

export type CreateExternalSourceTypeResponse = {
  createExternalSourceType: { attribute_schema: object; name: string };
};

export type GetExternalSourceTypeAttributeSchemaResponse = {
  external_source_type_by_pk: { attribute_schema: object };
};

export type GetExternalEventTypeAttributeSchemaResponse = {
  external_event_type_by_pk: { attribute_schema: object };
};
