import type { Express } from 'express';
import { unlinkSync } from 'fs';
import multer from 'multer';

export default (app: Express) => {
  const { FILE_STORE_PATH = '/tmp' } = process.env;

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

  app.get('/file/:path([^/]*)', (req, res) => {
    const { params } = req;
    const { path } = params;
    const absolutePath = `${FILE_STORE_PATH}/${path}`;
    res.download(absolutePath);
  });

  app.post('/file', upload.any(), (req, res) => {
    const { files } = req;
    res.json({ files, success: true });
  });
};
