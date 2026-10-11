// Label + input + optional hint, wired together for screen readers.
export default function Field({ label, id, hint, children, ...inputProps }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children || <input id={id} aria-describedby={hint ? `${id}-hint` : undefined} {...inputProps} />}
      {hint && <p className="hint" id={`${id}-hint`}>{hint}</p>}
    </div>
  );
}
