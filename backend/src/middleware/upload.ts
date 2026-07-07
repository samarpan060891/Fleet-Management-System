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

// Spreadsheet upload for bulk import (xlsx/xls/csv). Browsers occasionally send
// application/octet-stream, so accept it and rely on the parser to validate.
const SHEET_MIME = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/octet-stream',
];
export const uploadSpreadsheet = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.storage.maxSizeMb * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!SHEET_MIME.includes(file.mimetype)) {
      return cb(BadRequest(`File type ${file.mimetype} is not allowed for import (use .xlsx)`));
    }
    cb(null, true);
  },
});
