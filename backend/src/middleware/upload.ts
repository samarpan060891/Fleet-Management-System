import multer from 'multer';
import { env } from '../config/env';
import { BadRequest } from '../lib/errors';

// In-memory upload with file-type and size checks, then persisted via storage
// abstraction in the route handler.
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.storage.maxSizeMb * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!env.storage.allowedMime.includes(file.mimetype)) {
      return cb(BadRequest(`File type ${file.mimetype} is not allowed`));
    }
    cb(null, true);
  },
});
