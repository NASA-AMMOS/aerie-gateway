export type ImportSequenceTemplatePayload = {
  activity_type: string;
  language: string;
  model_id: number;
  name: string;
  parcel_id: number;
  sequence_template_file: string;
};

export type SequenceTemplateInsertInput = {
  activity_type: string;
  language: string;
  model_id: number;
  name: string;
  parcel_id: number;
  template_definition: string;
};

export type SequenceTemplateSchema = SequenceTemplateInsertInput & { id: number; owner: string };
