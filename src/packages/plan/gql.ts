export default {
  CREATE_ACTIVITY_DIRECTIVES: `#graphql
    mutation CreateActivityDirectives($activityDirectivesInsertInput: [activity_directive_insert_input!]!) {
      insert_activity_directive(objects: $activityDirectivesInsertInput) {
        returning {
          id
          type
        }
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
        simulations {
          id
        }
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
  CREATE_TAGS: `#graphql
    mutation CreateTags($tags: [tags_insert_input!]!) {
      insert_tags(objects: $tags, on_conflict: {
        constraint: tags_name_key,
        update_columns: []
      }) {
        affected_rows
        returning {
          color
          created_at
          id
          name
          owner
        }
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
  GET_TAGS: `#graphql
    query GetTags {
      tags(order_by: { name: desc })  {
        color
        created_at
        id
        name
        owner
      }
    }
  `,
  UPDATE_ACTIVITY_DIRECTIVES: `#graphql
    mutation UpdateActivityDirective($updates: [activity_directive_updates!]!) {
      update_activity_directive_many(
        updates: $updates
      ) {
        affected_rows
      }
    }
  `,
  UPDATE_SIMULATION: `#graphql
    mutation InitialSimulationUpdate($plan_id: Int!, $simulation: simulation_set_input!) {
      update_simulation(where: {plan_id: {_eq: $plan_id}}, _set: $simulation) {
        returning {
          id
        }
      }
    }
  `,
};
