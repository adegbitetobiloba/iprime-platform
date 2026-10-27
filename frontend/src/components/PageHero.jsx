import Photo from "./Photo.jsx";

// Consistent opening block for the public pages. An optional `image` (from siteImages.js) sits beside the text.
export default function PageHero({ eyebrow, title, children, image }) {
  return (
    <section className="page-hero">
      <div className={`container reveal${image ? " page-hero-split" : ""}`}>
        <div className="page-hero-copy">
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h1>{title}</h1>
          {children && <p className="lead">{children}</p>}
        </div>
        {image && <Photo image={image} priority className="page-hero-photo" />}
      </div>
    </section>
  );
}
