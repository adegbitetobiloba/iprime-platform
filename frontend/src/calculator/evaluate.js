// Safe calculator engine for the examination calculator. No eval(), no Function(): the expression is turned into tokens
// and parsed by a small recursive-descent parser, so only numbers, operators and the listed functions can ever run.
//
// Supported: + - × ÷ ^ ( ) % ! (percent is "divide by 100"), decimals, unary minus/plus, implicit multiplication (2(3), 2π, 3sin(30)),
// functions sin cos tan asin acos atan log ln sqrt (also the √ sign), constants π e and Ans (the last result).
// Angles use degrees or radians (mode "deg" | "rad"). Missing closing brackets at the end are closed automatically.

export class CalcError extends Error {}

const FUNCS = new Set(["sin", "cos", "tan", "asin", "acos", "atan", "log", "ln", "sqrt"]);
const MAX_LEN = 200;

function tokenize(src) {
  const out = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === " " || ch === "\u00a0") { i++; continue; }
    if ((ch >= "0" && ch <= "9") || ch === ".") {
      let j = i, dots = 0;
      while (j < src.length && ((src[j] >= "0" && src[j] <= "9") || src[j] === ".")) { if (src[j] === ".") dots++; j++; }
      if (dots > 1 || (j - i === 1 && ch === ".")) throw new CalcError("Syntax error");
      out.push({ t: "num", v: parseFloat(src.slice(i, j)) });
      i = j; continue;
    }
    if (/[a-zA-Z]/.test(ch)) {
      let j = i;
      while (j < src.length && /[a-zA-Z]/.test(src[j])) j++;
      const word = src.slice(i, j).toLowerCase();
      if (FUNCS.has(word)) out.push({ t: "fn", v: word });
      else if (word === "pi") out.push({ t: "const", v: "pi" });
      else if (word === "e") out.push({ t: "const", v: "e" });
      else if (word === "ans") out.push({ t: "const", v: "ans" });
      else throw new CalcError("Syntax error");
      i = j; continue;
    }
    switch (ch) {
      case "+": out.push({ t: "op", v: "+" }); break;
      case "-": case "\u2212": case "\u2013": out.push({ t: "op", v: "-" }); break;
      case "*": case "\u00d7": out.push({ t: "op", v: "*" }); break;
      case "/": case "\u00f7": out.push({ t: "op", v: "/" }); break;
      case "^": out.push({ t: "op", v: "^" }); break;
      case "%": out.push({ t: "post", v: "%" }); break;
      case "!": out.push({ t: "post", v: "!" }); break;
      case "(": out.push({ t: "lp" }); break;
      case ")": out.push({ t: "rp" }); break;
      case "\u03c0": out.push({ t: "const", v: "pi" }); break;
      case "\u221a": out.push({ t: "fn", v: "sqrt" }); break;
      default: throw new CalcError("Syntax error");
    }
    i++;
  }
  return out;
}

function factorial(n) {
  if (!Number.isInteger(n) || n < 0 || n > 170) throw new CalcError("Invalid input");
  let r = 1;
  for (let k = 2; k <= n; k++) r *= k;
  return r;
}

// Trig in degrees, with exact answers at multiples of 90 so sin(180) is 0 and not 1.2e-16.
function trig(name, x, mode) {
  let a = x;
  if (mode === "deg") {
    const turns = ((a % 360) + 360) % 360;
    if (Number.isInteger(turns / 90)) {
      const q = turns / 90; // 0..3
      if (name === "sin") return [0, 1, 0, -1][q];
      if (name === "cos") return [1, 0, -1, 0][q];
      if (name === "tan") { if (q === 1 || q === 3) throw new CalcError("Invalid input"); return 0; }
    }
    a = (a * Math.PI) / 180;
  } else if (name === "tan") {
    const k = a / (Math.PI / 2);
    if (Math.abs(k - Math.round(k)) < 1e-12 && Math.round(k) % 2 !== 0) throw new CalcError("Invalid input");
  }
  const r = name === "sin" ? Math.sin(a) : name === "cos" ? Math.cos(a) : Math.tan(a);
  return Math.abs(r) < 1e-12 ? 0 : r;
}

function applyFn(name, x, mode) {
  switch (name) {
    case "sqrt": if (x < 0) throw new CalcError("Invalid input"); return Math.sqrt(x);
    case "log": if (x <= 0) throw new CalcError("Invalid input"); return Math.log10(x);
    case "ln": if (x <= 0) throw new CalcError("Invalid input"); return Math.log(x);
    case "sin": case "cos": case "tan": return trig(name, x, mode);
    case "asin": case "acos": {
      if (x < -1 || x > 1) throw new CalcError("Invalid input");
      const r = name === "asin" ? Math.asin(x) : Math.acos(x);
      return mode === "deg" ? (r * 180) / Math.PI : r;
    }
    case "atan": { const r = Math.atan(x); return mode === "deg" ? (r * 180) / Math.PI : r; }
    default: throw new CalcError("Syntax error");
  }
}

function parse(tokens, ctx) {
  let p = 0;
  const peek = () => tokens[p];
  const next = () => tokens[p++];
  const startsPrimary = (t) => t && (t.t === "num" || t.t === "const" || t.t === "fn" || t.t === "lp");

  function expression() {
    let v = term();
    while (peek() && peek().t === "op" && (peek().v === "+" || peek().v === "-")) {
      const op = next().v;
      const r = term();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }
  function term() {
    let v = unary();
    for (;;) {
      const t = peek();
      if (t && t.t === "op" && (t.v === "*" || t.v === "/")) {
        next();
        const r = unary();
        if (t.v === "/") { if (r === 0) throw new CalcError("Cannot divide by zero"); v /= r; } else v *= r;
      } else if (startsPrimary(t)) {
        v *= unary(); // implicit multiplication: 2(3), 2π, 3sin(30)
      } else break;
    }
    return v;
  }
  function unary() {
    const t = peek();
    if (t && t.t === "op" && (t.v === "-" || t.v === "+")) { next(); const v = unary(); return t.v === "-" ? -v : v; }
    return power();
  }
  function power() {
    const base = postfix();
    const t = peek();
    if (t && t.t === "op" && t.v === "^") {
      next();
      const ex = unary(); // right-associative, and allows 2^-3
      if (base === 0 && ex < 0) throw new CalcError("Cannot divide by zero");
      if (base === 0 && ex === 0) throw new CalcError("Invalid input");
      const r = Math.pow(base, ex);
      if (Number.isNaN(r)) throw new CalcError("Invalid input");
      return r;
    }
    return base;
  }
  function postfix() {
    let v = primary();
    while (peek() && peek().t === "post") {
      const op = next().v;
      v = op === "%" ? v / 100 : factorial(v);
    }
    return v;
  }
  function primary() {
    const t = next();
    if (!t) throw new CalcError("Syntax error");
    if (t.t === "num") return t.v;
    if (t.t === "const") {
      if (t.v === "pi") return Math.PI;
      if (t.v === "e") return Math.E;
      if (typeof ctx.ans !== "number") throw new CalcError("No previous answer");
      return ctx.ans;
    }
    if (t.t === "lp") {
      const v = expression();
      if (peek() && peek().t === "rp") next(); // a missing ")" at the very end is closed for the student
      else if (peek()) throw new CalcError("Syntax error");
      return v;
    }
    if (t.t === "fn") {
      const arg = peek() && peek().t === "lp" ? primary() : peek() && (peek().t === "num" || peek().t === "const" || peek().t === "fn") ? postfix() : (() => { throw new CalcError("Syntax error"); })();
      return applyFn(t.v, arg, ctx.mode);
    }
    throw new CalcError("Syntax error");
  }

  const v = expression();
  if (p < tokens.length) throw new CalcError("Syntax error");
  return v;
}

// Evaluates an expression. Returns { ok: true, value } or { ok: false, error }. An empty expression returns { ok: true, value: null }.
export function evaluate(src, { mode = "deg", ans = null } = {}) {
  try {
    if (typeof src !== "string" || src.trim() === "") return { ok: true, value: null };
    if (src.length > MAX_LEN) throw new CalcError("Expression too long");
    const value = parse(tokenize(src), { mode, ans });
    if (Number.isNaN(value)) throw new CalcError("Invalid input");
    if (!Number.isFinite(value)) throw new CalcError("Overflow");
    return { ok: true, value };
  } catch (e) {
    if (e instanceof CalcError) return { ok: false, error: e.message };
    if (e instanceof RangeError) return { ok: false, error: "Expression too complex" };
    return { ok: false, error: "Error" };
  }
}

// Rounds away floating-point noise (0.1 + 0.2 shows 0.3) and switches to exponent form for very large or small numbers.
export function formatNumber(x) {
  if (x === 0 || Object.is(x, -0)) return "0";
  const a = Math.abs(x);
  if (a >= 1e12 || a < 1e-6) {
    const [m, e] = x.toExponential(11).split("e");
    const mant = m.includes(".") ? m.replace(/0+$/, "").replace(/\.$/, "") : m;
    return `${mant}e${e.replace("+", "")}`;
  }
  return String(parseFloat(x.toPrecision(12)));
}
