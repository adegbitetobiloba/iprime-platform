// "On this page" chips for long pages. Plain anchor links, so they work without JavaScript and with the keyboard.
export default function AnchorNav({ items, label = "On this page" }) {
  return (
    <nav className="ws5-anchor" aria-label={label}>
      <ul className="container ws5-anchor-list">
        {items.map((i) => (<li key={i.id}><a href={`#${i.id}`} className="ws5-anchor-link">{i.label}</a></li>))}
      </ul>
    </nav>
  );
}
