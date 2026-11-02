// Checks for uploaded syllabus/notes images. Pure, so it can be tested without a server.
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_IMAGES = 40;

// Returns { type } for a real JPEG, PNG or WebP, or { error }.
function checkImageBuffer(buf) {
  if (!Buffer.isBuffer(buf) || buf.length === 0) return { error: "No image was received. Send the image as the request body." };
  if (buf.length > MAX_IMAGE_BYTES) return { error: `That image is too large. The limit is ${MAX_IMAGE_BYTES / 1024 / 1024} MB.` };
  if (buf.length < 100) return { error: "That file is too small to be an image." };
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { type: "image/jpeg" };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { type: "image/png" };
  if (buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") return { type: "image/webp" };
  return { error: "Only JPEG, PNG or WebP images can be uploaded." };
}
module.exports = { MAX_IMAGE_BYTES, MAX_IMAGES, checkImageBuffer };
