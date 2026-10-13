import { useState } from "react";
import Icon from "./Icon.jsx";

// Label + input + optional hint, wired together for screen readers.
// Password fields get a show/hide button (display only: the value is never changed or stored).
export default function Field({ label, id, hint, children, type, ...inputProps }) {
  const [show, setShow] = useState(false);
  const describedBy = hint ? `${id}-hint` : undefined;

  let control = children;
  if (!control && type === "password") {
    control = (
      <div className="input-wrap">
        <input id={id} type={show ? "text" : "password"} aria-describedby={describedBy} {...inputProps} />
        <button type="button" className="input-toggle" onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"} aria-pressed={show}>
          <Icon name={show ? "eye-off" : "eye"} />
        </button>
      </div>
    );
  } else if (!control) {
    control = <input id={id} type={type} aria-describedby={describedBy} {...inputProps} />;
  }

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {control}
      {hint && <p className="hint" id={`${id}-hint`}>{hint}</p>}
    </div>
  );
}
