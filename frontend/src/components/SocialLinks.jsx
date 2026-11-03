// Social links shown with recognisable icons. Icons are small inline SVGs (no extra download), coloured with the surrounding text colour,
// and every link has a readable name for screen readers. variant "pills" = icon + name; "icons" = round icon buttons (name on hover/long-press).
const G = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };

const ICONS = {
  facebook: <path d="M14.5 8H16V5h-2.4C11.4 5 10 6.5 10 8.6V11H8v3h2v6h3v-6h2.3l.5-3H13V9.2c0-.7.4-1.2 1.5-1.2z" fill="currentColor" stroke="none" />,
  youtube: (<><rect x="2.5" y="5.5" width="19" height="13" rx="4" /><path d="M10 9.5l5 2.5-5 2.5z" fill="currentColor" stroke="none" /></>),
  "whatsapp-channel": (<><path d="M4 20l1.2-4.1A8 8 0 1 1 8.2 19z" /><path d="M9 8.8c.3 2.6 2.6 4.9 5.2 5.2l1-1.2-1.8-1-.8.6c-.7-.3-1.6-1.2-1.9-1.9l.6-.8-1-1.8z" fill="currentColor" stroke="none" /></>),
  telegram: (<><path d="M21 3L2 10.5l6 2.2 2.2 6L13 15l4.5 3.5z" /><path d="M8 12.7L21 3" /></>),
  x: <path d="M4.5 4.5l15 15M19.5 4.5l-15 15" />,
};

export function SocialIcon({ id }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false" {...G}>
      {ICONS[id] || <circle cx="12" cy="12" r="8" />}
    </svg>
  );
}

export default function SocialLinks({ items, variant = "pills", className = "" }) {
  return (
    <ul className={`ws5-social${variant === "icons" ? " ws5-social-icons" : ""} ${className}`.trim()}>
      {items.map((s) => (
        <li key={s.id}>
          <a href={s.href} target="_blank" rel="noopener noreferrer" aria-label={`${s.label} (opens in a new tab)`} title={s.label}>
            <SocialIcon id={s.id} />
            {variant === "pills" && <span>{s.label}</span>}
          </a>
        </li>
      ))}
    </ul>
  );
}
