import Ajv from 'ajv';
import type { Express } from 'express';
import { readFileSync } from 'fs';

export default (app: Express) => {
  const ajv = new Ajv();
  const schema = readFileSync('schemas/view.json').toString();
  const jsonSchema = JSON.parse(schema);
  const validate = ajv.compile<any>(jsonSchema);

  /**
   * @swagger
   * /view/validate:
   *   post:
   *     consumes:
   *       - application/json
   *     produces:
   *       - application/json
   *     requestBody:
   *       description: View JSON
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *     responses:
   *       200:
   *         description: ValidateViewResponse
   *     summary: Validate a view against it's JSON schema
   *     tags:
   *       - Views
   */
  app.post('/view/validate', async (req, res) => {
    const { body } = req;
    const valid = validate(body);

    if (!valid) {
      const errors = validate.errors;
      res.json({ errors, valid });
    } else {
      res.json({ valid });
    }
  });
};
