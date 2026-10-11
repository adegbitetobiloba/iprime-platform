import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <section className="auth"><div className="container narrow">
      <h1>Page not found</h1>
      <p className="muted">That page does not exist. <Link to="/">Go to the homepage</Link>.</p>
    </div></section>
  );
}
