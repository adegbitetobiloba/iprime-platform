import Icon from "./Icon.jsx";
import { ACCOUNT_TYPES } from "../accountTypes.js";

// Choose how you relate to the institution. A radio group, so it works with keyboard and screen readers.
export default function TypeCards({ value, onChange, name = "account-type" }) {
  return (
    <fieldset className="type-cards">
      <legend className="sr-only">Account type</legend>
      {ACCOUNT_TYPES.map((t) => (
        <label key={t.id} className={`type-card${value === t.id ? " is-selected" : ""}`}>
          <input type="radio" name={name} value={t.id} checked={value === t.id} onChange={() => onChange(t.id)} />
          <span className="icon-tile icon-tile-sm"><Icon name={t.icon} size={18} /></span>
          <span className="type-text"><strong>{t.title}</strong><span className="type-blurb">{t.blurb}</span></span>
        </label>
      ))}
    </fieldset>
  );
}
