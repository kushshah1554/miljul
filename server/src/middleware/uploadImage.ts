import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { AppError } from "../utils/AppError";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) return callback(null, true);
    callback(new AppError(400, "Image must be a JPEG, PNG or WebP file"));
  },
}).single("image");

/** Parses an optional `image` file field, plus any text fields, from a multipart body. */
export function uploadImage(req: Request, res: Response, next: NextFunction) {
  upload(req, res, (error: unknown) => {
    if (!error || error instanceof AppError) return next(error);

    // Everything multer rejects is a bad request, not a server fault
    const tooLarge =
      error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE";
    next(
      new AppError(
        400,
        tooLarge ? "Image must be 5 MB or smaller" : "Invalid image upload",
      ),
    );
  });
}
