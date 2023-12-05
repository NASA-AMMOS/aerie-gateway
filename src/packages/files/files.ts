import type { Express } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { customAlphabet } from 'nanoid';
import { parse } from 'path';
import { getEnv } from '../../env.js';
import getLogger from '../../logger.js';
import { auth } from '../auth/middleware.js';
import { DbMerlin } from '../db/db.js';

const logger = getLogger('packages/files/files');

export default (app: Express) => {
  const { RATE_LIMITER_FILES_MAX } = getEnv();

  const filesLimiter = rateLimit({
    legacyHeaders: false,
    max: RATE_LIMITER_FILES_MAX,
    standardHeaders: true,
    windowMs: 15 * 60 * 1000, // 15 minutes
  });

  const db = DbMerlin.getDb();
  const fileStorePath = 'files';

  const storage = multer.diskStorage({
    destination(_, __, cb) {
      cb(null, fileStorePath);
    },
    filename(_, file, cb) {
      const { originalname } = file;
      const nanoId = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 14);
      const uniqueId = nanoId();
      const now = Date.now();
      const { ext, name } = parse(originalname);
      const uniqueFileName = `${name}-${now}-${uniqueId}`;
      const fileName = `${uniqueFileName}${ext}`;
      cb(null, fileName);
    },
  });

  const upload = multer({ storage });

  /**
   * @swagger
   * /file/{id}:
   *   delete:
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - description: ID of the file to delete
   *         in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: number
   *     responses:
   *       200:
   *         description: DeleteFileResponse
   *     summary: Delete a file from the filesystem
   *     tags:
   *       - Files
   */
  app.delete('/file/:id', filesLimiter, auth, async (req, res) => {
    const { params } = req;
    const { id } = params;

    try {
      const deleted_date = new Date();
      const { rowCount } = await db.query(
        `
        update uploaded_file
        set deleted_date = $1
        where id = $2;
      `,
        [deleted_date, id],
      );

      // @ts-ignore
      if (rowCount > 0) {
        logger.info(`DELETE /file: Marked file as deleted in the database: ${id}`);
      } else {
        logger.info(`DELETE /file: No file was marked as deleted in the database`);
      }

      res.json({ id, success: true });
    } catch (error: any) {
      logger.error(error);
      res.status(404).json({ message: error.message, success: false });
    }
  });

  /**
   * @swagger
   * /file:
   *   post:
   *     security:
   *       - bearerAuth: []
   *     consumes:
   *       - multipart/form-data
   *     produces:
   *       - application/json
   *     requestBody:
   *       content:
   *         multipart/form-data:
   *          schema:
   *            type: object
   *            properties:
   *              file:
   *                format: binary
   *                type: string
   *     responses:
   *       200:
   *         description: UploadFileResponse
   *     summary: Upload a file to the filesystem
   *     tags:
   *       - Files
   */
  app.post('/file', filesLimiter, auth, upload.any(), async (req, res) => {
    const [file] = req.files as Express.Multer.File[];
    const { filename } = file;

    // Note because name and path are different types, we need to bind the filename variable
    // twice so the query casts it appropriately to each type.
    const { rowCount, rows } = await db.query(
      `
      insert into uploaded_file (name, path)
      values ($1, $2)
      returning id;
    `,
      [filename, filename],
    );

    const [row] = rows;
    const id = row ? row.id : null;

    // @ts-ignore
    if (rowCount > 0) {
      logger.info(`POST /file: Added file to the database: ${id}`);
    } else {
      logger.info(`POST /file: No file was added to the database`);
    }

    res.json({ file, id });
  });
};
