import type { Express } from 'express';
import fastGlob from 'fast-glob';
import multer from 'multer';
import { Db } from '../db/db.js';

export default (app: Express) => {
  const db = Db.getDb();
  const { FILE_STORE_PATH = '/app/files' } = process.env;

  const storage = multer.diskStorage({
    destination(_, __, cb) {
      cb(null, FILE_STORE_PATH);
    },
    filename(_, file, cb) {
      const { fieldname, originalname } = file;
      cb(null, `${fieldname}${originalname}`);
    },
  });

  const upload = multer({ storage });

  /**
   * @swagger
   * /file/{path}:
   *   delete:
   *     parameters:
   *       - description: Name or path of the file to delete
   *         in: path
   *         name: path
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: DeleteFileResponse
   *     summary: Delete a file from the filesystem
   *     tags:
   *       - Files
   */
  app.delete('/file/:path([^/]*)', async (req, res) => {
    const { params } = req;
    const { path } = params;
    const absolutePath = `${FILE_STORE_PATH}/${path}`;

    try {
      const deleted_date = new Date();
      const { rowCount } = await db.query(
        `
        update merlin.uploaded_file
        set deleted_date = $1
        where name='${absolutePath}';
      `,
        [deleted_date],
      );

      if (rowCount > 0) {
        console.log(
          `DELETE /file: Marked file as deleted in the database: ${absolutePath}`,
        );
      } else {
        console.log(
          `DELETE /file: No file was marked as deleted in the database`,
        );
      }

      res.json({ path: absolutePath, success: true });
    } catch (error: any) {
      console.error(error);
      res.status(404).json({ message: error.message, success: false });
    }
  });

  /**
   * @swagger
   * /file/{path}:
   *   get:
   *     parameters:
   *       - description: Name or path of the file to fetch
   *         in: path
   *         name: path
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: File
   *     summary: Fetch a file from the filesystem
   *     tags:
   *       - Files
   */
  app.get('/file/:path([^/]*)', (req, res) => {
    const { params } = req;
    const { path } = params;
    const absolutePath = `${FILE_STORE_PATH}/${path}`;
    res.download(absolutePath);
  });

  /**
   * @swagger
   * /file:
   *   post:
   *     consumes:
   *       - multipart/form-data
   *     description: If a file of the same name and location already exists, the new file overwrites the old
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
  app.post('/file', upload.any(), async (req, res) => {
    const files = req.files as Express.Multer.File[];

    for (const file of files) {
      const { path } = file;
      const modified_date = new Date();
      const { rowCount } = await db.query(
        `
        insert into merlin.uploaded_file (name, path)
        values ('${path}', '${path}')
        on conflict (name) do update
        set path = '${path}', modified_date = $1, deleted_date = null;
      `,
        [modified_date],
      );

      if (rowCount > 0) {
        console.log(`POST /file: Updated file in the database: ${path}`);
      } else {
        console.log(`POST /file: No file was updated in the database`);
      }
    }

    res.json({ files, success: true });
  });

  /**
   * @swagger
   * /files:
   *   get:
   *     produces:
   *       - application/json
   *     responses:
   *       200:
   *         description: A list of absolute file paths
   *     summary: Returns a list of absolute paths for all files stored on the filesystem
   *     tags:
   *       - Files
   */
  app.get('/files', async (_, res) => {
    const files = await fastGlob(`${FILE_STORE_PATH}/**/*`);
    res.json(files);
  });
};
