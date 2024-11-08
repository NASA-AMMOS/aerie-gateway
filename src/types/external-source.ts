export type DerivationGroupInsertInput = {
  name: string;
  source_type_name: string;
}

export type ExternalSourceTypeInsertInput = {
  name: string;
  attribute_schema: object;
}

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
  }
  key: string;
  source_type_name: string;
  start_time: string;
  valid_at: string;
}
