export type ProfileSet = {
  type: 'discrete' | 'real';
  schema: object; // ValueSchema type
  segments: {
    duration: number;
    dynamics?: number | string | boolean | object; // `dynamics` should match `schema`
  }[];
};

export type UploadPlanDatasetPayload = {
  plan_id: string;
  simulation_dataset_id?: string;
};

export type UploadPlanDatasetJSON = {
  datasetStart: string;
  profileSet: Record<string, ProfileSet>;
};
