import Icon from "./Icon.jsx";

const POINTS = [
  "Email-verified accounts",
  "Accounts for students, parents and alumni",
  "Built for phones and low data",
];

// Shared frame for login, register and verify: a brand panel (wide screens only) beside the form.
export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <section className="auth-shell">
      <aside className="auth-panel" aria-hidden="false">
        <div className="auth-logo-card">
          <img src="/logo-full.webp" width="240" height="241"
            alt="Prime Excelerate: The Peak of Academic Excellence and Integrity" />
        </div>
        <ul className="auth-points">
          {POINTS.map((p) => (
            <li key={p}><span className="auth-tick"><Icon name="check" size={16} /></span>{p}</li>
          ))}
        </ul>
      </aside>
      <div className="auth-main">
        <div className="auth-box reveal">
          <h1>{title}</h1>
          {subtitle && <p className="muted">{subtitle}</p>}
          {children}
          {footer && <p className="auth-footer">{footer}</p>}
        </div>
      </div>
    </section>
  );
}
