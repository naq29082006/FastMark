const multer = require("multer");

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith("image/")) {
      const error = new Error("Chỉ cho phép upload file ảnh.");
      error.statusCode = 400;
      return cb(error);
    }

    cb(null, true);
  },
});

function singleImage(fieldName = "avatar") {
  return (req, res, next) => {
    imageUpload.single(fieldName)(req, res, (error) => {
      if (!error) {
        return next();
      }

      if (error.code === "LIMIT_FILE_SIZE") {
        error.statusCode = 400;
        error.message = "Ảnh không được lớn hơn 5MB.";
      }

      return next(error);
    });
  };
}

module.exports = {
  singleImage,
};
