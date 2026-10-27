// Photographs used on the website. Leave a value as null until an approved image file has been added
// to frontend/public/images/ (see docs/IMAGES.md); the layout then shows a designed fallback instead of a broken image.
// Credit and licence for every file are recorded in frontend/public/images/SOURCES.md.
export const IMAGES = {
  hero: null,        // waiting for a suitable photo of students at computers / a CBT session
  cbt: null,         // the designed question-palette illustration shows until a photo is added
  auth: null,        // reserved: portrait beside Login / Register
  about: { src: "/images/about.webp", alt: "A teacher smiling at the front of a classroom beside a whiteboard, holding a textbook", width: 1200, height: 800 },
  learning: { src: "/images/learning.webp", alt: "A curved library wall filled with shelves of books", width: 1200, height: 800 },
  programmes: { src: "/images/programmes.webp", alt: "A classroom of students seated at tables, facing a teacher at the front", width: 1200, height: 800 },
};
