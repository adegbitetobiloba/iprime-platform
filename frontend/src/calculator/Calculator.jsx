import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { evaluate, formatNumber } from "./evaluate.js";
import "./calculator.css";

// Examination calculator: a "Calculator" button for the exam bar plus a floating panel.
// It keeps all of its own state, takes no props and never touches the exam's answers, timer, navigation or submission.
// Keys only reach it while focus is inside the panel, so typing numbers never changes an answer option.

const OPEN_FN = /(asin\(|acos\(|atan\(|sin\(|cos\(|tan\(|log\(|ln\(|\u221a\(|Ans)$/;
const MAX_CHARS = 180;
const KEY_ARROWS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

// Default layout (4 columns, the "=" key is two rows tall): C DEL ÷ × / 7 8 9 − / 4 5 6 + / 1 2 3 = / 0 . √
const BASIC = [
  { l: "C", act: "clear", k: "ac", a: "clear all" },
  { l: "DEL", act: "del", k: "del", a: "delete last" },
  { l: "\u00f7", ins: "\u00f7", k: "op", a: "divide", kind: "op" },
  { l: "\u00d7", ins: "\u00d7", k: "op", a: "multiply", kind: "op" },
  { l: "7", ins: "7", k: "num", kind: "num" }, { l: "8", ins: "8", k: "num", kind: "num" }, { l: "9", ins: "9", k: "num", kind: "num" },
  { l: "\u2212", ins: "\u2212", k: "op", a: "subtract", kind: "op" },
  { l: "4", ins: "4", k: "num", kind: "num" }, { l: "5", ins: "5", k: "num", kind: "num" }, { l: "6", ins: "6", k: "num", kind: "num" },
  { l: "+", ins: "+", k: "op", a: "add", kind: "op" },
  { l: "1", ins: "1", k: "num", kind: "num" }, { l: "2", ins: "2", k: "num", kind: "num" }, { l: "3", ins: "3", k: "num", kind: "num" },
  { l: "=", act: "equals", k: "eq", a: "equals", tall: true },
  { l: "0", ins: "0", k: "num", kind: "num" }, { l: ".", ins: ".", k: "num", a: "decimal point", kind: "num" },
  { l: "\u221a", ins: "\u221a(", k: "fn", a: "square root", kind: "fn" },
];

// Extra keys, shown with the "Sci" button
function sciKeys(inv) {
  return [
    inv ? { l: "sin\u207b\u00b9", ins: "asin(", a: "inverse sine", trig: true } : { l: "sin", ins: "sin(", a: "sine", trig: true },
    inv ? { l: "cos\u207b\u00b9", ins: "acos(", a: "inverse cosine", trig: true } : { l: "cos", ins: "cos(", a: "cosine", trig: true },
    inv ? { l: "tan\u207b\u00b9", ins: "atan(", a: "inverse tangent", trig: true } : { l: "tan", ins: "tan(", a: "tangent", trig: true },
    { l: "log", ins: "log(", a: "logarithm base 10" },
    { l: "ln", ins: "ln(", a: "natural logarithm" },
    { l: "\u03c0", ins: "\u03c0", a: "pi", kind: "const" },
    { l: "e", ins: "e", a: "Euler's number e", kind: "const" },
    { l: "x\u02b8", ins: "^", a: "power", kind: "op" },
    { l: "x\u00b2", ins: "^2", a: "square", kind: "post" },
    { l: "x\u207b\u00b9", ins: "^(-1)", a: "reciprocal", kind: "post" },
    { l: "n!", ins: "!", a: "factorial", kind: "post" },
    { l: "%", ins: "%", a: "percent", kind: "post" },
    { l: "(", ins: "(", a: "open bracket", kind: "open" },
    { l: ")", ins: ")", a: "close bracket", kind: "close" },
    { l: "Ans", ins: "Ans", a: "previous answer", kind: "const", needsAns: true, wide: true },
  ].map((x) => ({ k: "fn", kind: "fn", ...x }));
}

function Calculator() {
  const [open, setOpen] = useState(false);
  const [expr, setExpr] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [ans, setAns] = useState(null);
  const [fresh, setFresh] = useState(false);   // true right after "=": the next number starts a new sum, an operator continues from Ans
  const [mode, setMode] = useState("deg");
  const [inv, setInv] = useState(false);
  const [sci, setSci] = useState(false);       // extra keys are one tap away
  const [pos, setPos] = useState(null);        // null = default place; otherwise { x, y } after the student moves it
  const [note, setNote] = useState("");

  const toggleRef = useRef(null);
  const panelRef = useRef(null);
  const screenRef = useRef(null);
  const dragRef = useRef(null);

  const close = useCallback((returnFocus) => {
    setOpen(false);
    if (returnFocus) toggleRef.current?.focus();
  }, []);

  // Focus the display when the panel opens, so the student can type straight away.
  useEffect(() => { if (open) screenRef.current?.focus({ preventScroll: true }); }, [open]);

  // Keep the end of a long expression in view.
  useLayoutEffect(() => { const el = screenRef.current; if (el) el.scrollLeft = el.scrollWidth; }, [expr, result, error, open]);

  // On phones the panel is docked at the bottom: leave room under the page (and above the Previous/Next bar) while it is open.
  useEffect(() => {
    if (!open) return undefined;
    const root = document.documentElement;
    const el = panelRef.current;
    root.classList.add("calc-open");
    root.classList.toggle("calc-docked", !pos);   // docked = still at its default place, so the page makes room for it
    const setH = () => root.style.setProperty("--calc-h", pos || !el ? "0px" : `${el.offsetHeight + 16}px`);
    setH();
    const ro = typeof ResizeObserver !== "undefined" && el ? new ResizeObserver(setH) : null;
    if (ro) ro.observe(el);
    return () => { if (ro) ro.disconnect(); root.classList.remove("calc-open", "calc-docked"); root.style.removeProperty("--calc-h"); };
  }, [open, pos === null, sci]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep a moved panel on screen when the window changes size or the panel grows.
  const clamp = useCallback((x, y) => {
    const el = panelRef.current;
    const w = el ? el.offsetWidth : 320, h = el ? el.offsetHeight : 400;
    return { x: Math.max(8, Math.min(x, window.innerWidth - w - 8)), y: Math.max(8, Math.min(y, window.innerHeight - h - 8)) };
  }, []);
  useEffect(() => {
    if (!open || !pos) return undefined;
    const fix = () => setPos((p) => (p ? clamp(p.x, p.y) : p));
    fix();
    window.addEventListener("resize", fix);
    return () => window.removeEventListener("resize", fix);
  }, [open, pos === null, sci, clamp]); // eslint-disable-line react-hooks/exhaustive-deps

  // ----- entering and calculating -----
  const append = (text, kind) => {
    if (error) setError(null);
    let base = expr;
    if (fresh) {
      base = kind === "op" || kind === "post" ? "Ans" : "";
      setFresh(false);
      setResult(null);
    }
    if (!base && (kind === "post" || (kind === "op" && text !== "\u2212"))) {
      if (ans === null) return;              // nothing to apply an operator to
      base = "Ans";
    }
    if (kind === "op" && /[+\u2212\u00d7\u00f7]$/.test(base) && text !== "\u2212" && !/[+\u2212\u00d7\u00f7(]$/.test(base.slice(0, -1))) {
      base = base.slice(0, -1);              // pressing a second operator replaces the first
    }
    if ((base + text).length > MAX_CHARS) return;
    setExpr(base + text);
  };

  const del = () => {
    if (error) setError(null);
    if (fresh) { setFresh(false); setResult(null); }
    setExpr((e) => (OPEN_FN.test(e) ? e.replace(OPEN_FN, "") : e.slice(0, -1)));
  };

  const clearAll = () => { setExpr(""); setResult(null); setError(null); setFresh(false); setNote("Cleared"); };

  const equals = () => {
    if (!expr) return;
    const r = evaluate(expr, { mode, ans });
    if (!r.ok) { setError(r.error); setResult(null); setFresh(false); setNote(`Error: ${r.error}`); return; }
    const text = formatNumber(r.value);
    setError(null); setResult(text); setAns(r.value); setFresh(true);
    setNote(`${expr} equals ${text}`);
  };

  const press = (key) => {
    if (key.act === "del") return del();
    if (key.act === "clear") return clearAll();
    if (key.act === "equals") return equals();
    append(key.ins, key.kind);
    if (key.trig && inv) setInv(false);
  };

  // ----- keyboard: only while focus is inside the calculator -----
  const onKeyDown = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    if (k === "Escape") { e.stopPropagation(); e.preventDefault(); close(true); return; }   // closes only the calculator, not the exam's submit dialog
    if (k === "Tab") return;
    const onButton = e.target instanceof HTMLElement && e.target.tagName === "BUTTON";
    if (onButton && (k === "Enter" || k === " ")) return;          // a focused key presses itself
    if (e.target instanceof HTMLElement && e.target.classList.contains("calc-grip") && KEY_ARROWS[k]) return;
    let handled = true;
    if (/^[0-9]$/.test(k)) append(k, "num");
    else if (k === "." || k === ",") append(".", "num");
    else if (k === "+") append("+", "op");
    else if (k === "-") append("\u2212", "op");
    else if (k === "*" || k === "x" || k === "X") append("\u00d7", "op");
    else if (k === "/") append("\u00f7", "op");
    else if (k === "^") append("^", "op");
    else if (k === "(") append("(", "open");
    else if (k === ")") append(")", "close");
    else if (k === "%") append("%", "post");
    else if (k === "!") append("!", "post");
    else if (k === "p" || k === "P") append("\u03c0", "const");
    else if (k === "r" || k === "R") append("\u221a(", "fn");
    else if (k === "Enter" || k === "=") equals();
    else if (k === "Backspace") del();
    else if (k === "Delete") clearAll();
    else handled = false;
    if (handled) e.preventDefault();
  };

  // ----- moving the panel (mouse, touch or arrow keys on the title bar) -----
  const onGripDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    const r = panelRef.current.getBoundingClientRect();
    dragRef.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onGripMove = (e) => { const d = dragRef.current; if (d) setPos(clamp(e.clientX - d.dx, e.clientY - d.dy)); };
  const onGripUp = () => { dragRef.current = null; };
  const onGripKey = (e) => {
    const step = KEY_ARROWS[e.key];
    if (!step) return;
    e.preventDefault();
    const r = panelRef.current.getBoundingClientRect();
    const n = e.shiftKey ? 64 : 16;
    setPos(clamp((pos ? pos.x : r.left) + step[0] * n, (pos ? pos.y : r.top) + step[1] * n));
  };

  // After a mouse or touch press, focus goes back to the display so typing and Enter keep working.
  // A press made from the keyboard (event.detail is 0) keeps focus on the key, so Tab navigation is not disturbed.
  const refocusAfterPointer = (e) => { if (e.detail > 0) screenRef.current?.focus({ preventScroll: true }); };

  const keys = sciKeys(inv);
  const shown = error ? error : result !== null ? result : expr || "0";

  const renderKey = (key) => (
    <button
      key={key.l + (key.a || "")}
      type="button"
      className={`calc-key calc-${key.k}${key.wide ? " calc-wide" : ""}${key.tall ? " calc-tall" : ""}`}
      aria-label={key.a || undefined}
      disabled={key.needsAns && ans === null}
      onClick={(e) => { press(key); refocusAfterPointer(e); }}
    >
      {key.l}
    </button>
  );

  return (
    <>
      <button
        ref={toggleRef}
        type="button"
        className="btn btn-secondary btn-sm calc-toggle"
        aria-expanded={open}
        aria-controls="exam-calculator"
        title="Calculator"
        onClick={() => (open ? close(false) : setOpen(true))}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
          <rect x="5" y="2.5" width="14" height="19" rx="2.5" />
          <path d="M8.5 7h7M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01" />
        </svg>
        <span className="calc-toggle-label">Calculator</span>
      </button>

      {open && (
        <div
          id="exam-calculator"
          ref={panelRef}
          className={`calc${pos ? " is-moved" : ""}`}
          style={pos ? { left: pos.x, top: pos.y } : undefined}
          role="dialog"
          aria-modal="false"
          aria-label="Calculator"
          onKeyDown={onKeyDown}
        >
          <div className="calc-head">
            <button
              type="button"
              className="calc-grip"
              aria-label="Move calculator (drag, or use the arrow keys)"
              onPointerDown={onGripDown}
              onPointerMove={onGripMove}
              onPointerUp={onGripUp}
              onPointerCancel={onGripUp}
              onKeyDown={onGripKey}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true" focusable="false">
                <circle cx="4" cy="3" r="1.3" /><circle cx="10" cy="3" r="1.3" /><circle cx="4" cy="7" r="1.3" /><circle cx="10" cy="7" r="1.3" /><circle cx="4" cy="11" r="1.3" /><circle cx="10" cy="11" r="1.3" />
              </svg>
              <span>Calculator</span>
            </button>
            <button type="button" className="calc-sci-toggle" aria-pressed={sci} aria-label="Scientific functions" onClick={() => setSci((s) => !s)}>Sci</button>
            <button type="button" className="calc-close" aria-label="Close calculator" onClick={() => close(true)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>

          <div className="calc-screen">
            <div className="calc-history" aria-hidden="true">{result !== null || error ? expr : ""}</div>
            <div
              ref={screenRef}
              className={`calc-main${error ? " is-error" : ""}`}
              role="textbox"
              aria-readonly="true"
              aria-label={error ? "Calculator display, error" : "Calculator display"}
              aria-describedby="calc-help"
              tabIndex={0}
            >
              {shown}
            </div>
          </div>

          {sci && (
            <div className="calc-modes">
              <button type="button" className="calc-mode" aria-label={mode === "deg" ? "Angle mode: degrees. Switch to radians" : "Angle mode: radians. Switch to degrees"} onClick={(e) => { setMode((m) => (m === "deg" ? "rad" : "deg")); refocusAfterPointer(e); }}>
                {mode === "deg" ? "DEG" : "RAD"}
              </button>
              <button type="button" className="calc-mode" aria-pressed={inv} aria-label="Inverse trigonometric functions" onClick={(e) => { setInv((v) => !v); refocusAfterPointer(e); }}>Inv</button>
            </div>
          )}

          <div className="calc-keys">
            {sci && <div className="calc-grid">{keys.map(renderKey)}</div>}
            <div className="calc-grid">{BASIC.map(renderKey)}</div>
          </div>

          <p className="sr-only" role="status" aria-live="polite">{note}</p>
          <p className="sr-only" id="calc-help">
            Keyboard: type numbers and the symbols plus, minus, star, slash, caret, brackets and percent. Enter calculates. Backspace deletes. Delete clears all. P is pi. R is square root. Escape closes the calculator.
          </p>
        </div>
      )}
    </>
  );
}

export default memo(Calculator);
