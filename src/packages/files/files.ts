import type { Express } from 'express';
import fastGlob from 'fast-glob';
import { unlinkSync } from 'fs';
import multer from 'multer';

export default (app: Express) => {
  const { FILE_STORE_PATH = '/usr/src/app/merlin_file_store' } = process.env;

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
  app.delete('/file/:path([^/]*)', (req, res) => {
    const { params } = req;
    const { path } = params;
    const absolutePath = `${FILE_STORE_PATH}/${path}`;

    try {
      unlinkSync(absolutePath);
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
  app.post('/file', upload.any(), (req, res) => {
    const { files } = req;
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
   *         description: A list of all absolute file paths under the FILE_STORE_PATH environment variable
   *     summary: Returns a list of absolute paths for all files stored in the filesystem
   *     tags:
   *       - Files
   */
  app.get('/files', async (_, res) => {
    const files = await fastGlob(`${FILE_STORE_PATH}/**/*`);
    res.json(files);
  });
};
