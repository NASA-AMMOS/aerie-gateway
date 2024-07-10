import type { UserId } from '../auth/types';

export type PlanSchema = {
  created_at: string;
  duration: string;
  id: number;
  model_id: number;
  name: string;
  owner: UserId;
  revision: number;
  start_time: string;
  updated_at: string;
  updated_by: UserId;
};

export type PlanInsertInput = Pick<PlanSchema, 'duration' | 'model_id' | 'name' | 'start_time'>;

export type PlanTagsInsertInput = {
  plan_id: number;
  tag_id: number;
};

export type ImportPlanPayload = {
  duration: string;
  model_id: number;
  name: string;
  sim_id: number;
  start_time: string;
  tags: string;
};

export type Argument = any;
export type ParameterName = string;
export type ArgumentsMap = Record<ParameterName, Argument>;

export type ActivityMetadataKey = string;
export type ActivityMetadataValue = any;
export type ActivityMetadata = Record<ActivityMetadataKey, ActivityMetadataValue>;

export type ActivityDirectiveId = number;
export type ActivityDirective = {
  anchor_id: number | null;
  anchored_to_start: boolean;
  arguments: ArgumentsMap;
  id: ActivityDirectiveId;
  metadata: ActivityMetadata;
  name: string;
  start_offset: string;
  type: string;
};

export type ActivityDirectiveInsertInput = {
  anchor_id: number | null;
  anchored_to_start: boolean;
  arguments: ArgumentsMap;
  metadata: ActivityMetadata;
  name: string;
  plan_id: number;
  start_offset: string;
  type: string;
};
export type ActivityDirectiveSetInput = Pick<ActivityDirectiveInsertInput, 'anchor_id'>;

export type PlanTransfer = Pick<PlanSchema, 'id' | 'model_id' | 'name' | 'start_time'> & {
  activities: Pick<
    ActivityDirective,
    'anchor_id' | 'anchored_to_start' | 'arguments' | 'id' | 'metadata' | 'name' | 'start_offset' | 'type'
  >[];
  end_time: string;
  sim_id: number;
  tags: {
    tag: {
      id: number;
      name: string;
    };
  }[];
};
