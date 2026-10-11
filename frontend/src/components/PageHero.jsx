// Consistent opening block for the public pages.
export default function PageHero({ eyebrow, title, children }) {
  return (
    <section className="page-hero">
      <div className="container reveal">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {children && <p className="lead">{children}</p>}
      </div>
    </section>
  );
}
