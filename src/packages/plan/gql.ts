export default {
  CREATE_ACTIVITY_DIRECTIVE: `#graphql
    mutation CreateActivityDirective($activityDirectiveInsertInput: activity_directive_insert_input!) {
      insert_activity_directive_one(object: $activityDirectiveInsertInput) {
        id
        type
      }
    }
  `,
  CREATE_PLAN: `#graphql
    mutation CreatePlan($plan: plan_insert_input!) {
      createPlan: insert_plan_one(object: $plan) {
        created_at
        collaborators {
          collaborator
        }
        duration
        id
        owner
        revision
        start_time
        updated_at
        updated_by
      }
    }
  `,
  CREATE_PLAN_TAGS: `#graphql
    mutation CreatePlanTags($tags: [plan_tags_insert_input!]!) {
      insert_plan_tags(objects: $tags, on_conflict: {
        constraint: plan_tags_pkey,
        update_columns: []
      }) {
        affected_rows
      }
    }
  `,
  DELETE_PLAN: `#graphql
    mutation DeletePlan($id: Int!) {
      deletePlan: delete_plan_by_pk(id: $id) {
        id
      }
    }
  `,
  UPDATE_ACTIVITY_DIRECTIVE: `#graphql
    mutation UpdateActivityDirective($id: Int!, $plan_id: Int!, $activityDirectiveSetInput: activity_directive_set_input!) {
      update_activity_directive_by_pk(
        pk_columns: { id: $id, plan_id: $plan_id }, _set: $activityDirectiveSetInput
      ) {
        anchor_id
        id
      }
    }
  `,
};
