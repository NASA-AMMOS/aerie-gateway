export default {
  CREATE_SEQUENCE_TEMPLATE: `#graphql
    mutation CreateSequenceTemplate($sequenceTemplateInsertInput: [sequence_template_insert_input!]!) {
      insert_sequence_template(objects: $sequenceTemplateInsertInput) {
        returning {
          id
        }
      }
    }
  `,
};
