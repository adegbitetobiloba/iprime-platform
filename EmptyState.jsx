import Icon from "./Icon.jsx";

// Honest placeholder shown when the institution has not published anything yet.
export default function EmptyState({ icon = "book", title, children, action }) {
  return (
    <div className="empty-state">
      <span className="icon-tile"><Icon name={icon} size={22} /></span>
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </div>
  );
}
