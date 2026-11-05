import { v2 as cloudinary } from "cloudinary";
import { AppError } from "../utils/AppError";
import { env } from "./env";

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true,
});

/** Stores the picture under the user's id, so a new one replaces the old one. */
export function uploadProfileImage(
  userId: string,
  image: Buffer,
): Promise<string> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder: "room-management/profiles",
          public_id: userId,
          overwrite: true,
          invalidate: true,
          resource_type: "image",
          // The browser's file type can be faked; Cloudinary checks the real one
          allowed_formats: ["jpg", "png", "webp"],
          transformation: [
            { width: 400, height: 400, crop: "fill", gravity: "face" },
          ],
        },
        (error, result) => {
          if (result) return resolve(result.secure_url);

          console.error("Cloudinary upload failed:", error);
          reject(
            error?.http_code === 400
              ? new AppError(400, "That file is not a valid image")
              : new AppError(502, "Could not upload image, please try again"),
          );
        },
      )
      .end(image);
  });
}
