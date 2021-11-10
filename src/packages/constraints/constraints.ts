import Ajv from 'ajv';
import type { Express } from 'express';
import { readFileSync } from 'fs';

export default (app: Express) => {
  const ajv = new Ajv();
  ajv.addKeyword('$anchor');
  const schema = readFileSync('schemas/constraint.json').toString();
  const jsonSchema = JSON.parse(schema);
  const validate = ajv.compile<any>(jsonSchema);

  /**
   * @swagger
   * /constraint/validate:
   *   post:
   *     consumes:
   *       - application/json
   *     produces:
   *       - application/json
   *     requestBody:
   *       description: Constraint JSON
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *     responses:
   *       200:
   *         description: ValidateConstraintResponse
   *     summary: Validate a constraint against it's JSON schema
   *     tags:
   *       - Constraints
   */
  app.post('/constraint/validate', async (req, res) => {
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
