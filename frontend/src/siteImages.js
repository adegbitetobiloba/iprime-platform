// Photographs used on the website. Leave a value as null until an approved image file has been added
// to frontend/public/images/ (see docs/IMAGES.md); the layout then shows a designed fallback instead of a broken image.
// Credit and licence for every file are recorded in frontend/public/images/SOURCES.md.
export const IMAGES = {
  hero: null,        // waiting for a suitable photo of students at computers / a CBT session
  // The current campaign flyer for the homepage hero. Set it ONLY after management confirms it is the current approved flyer
  // AND has decided what may stay visible on it (the supplied 2027 flyer shows named scorers, an account number, phone numbers
  // and a fee, which must not go public unverified). Use the original file unedited: { src, alt, width, height }.
  campaign: null,
  cbt: null,         // the designed question-palette illustration shows until a photo is added
  auth: null,        // reserved: portrait beside Login / Register
  about: { src: "/images/about.webp", alt: "A teacher smiling at the front of a classroom beside a whiteboard, holding a textbook", width: 1200, height: 800 },
  learning: { src: "/images/learning.webp", alt: "A curved library wall filled with shelves of books", width: 1200, height: 800 },
  programmes: { src: "/images/programmes.webp", alt: "A classroom of students seated at tables, facing a teacher at the front", width: 1200, height: 800 },
};
