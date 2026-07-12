"use client";

// Панель математических символов: вставка в позицию курсора textarea
const MATH_BUTTONS = [
  { l: "+", i: "+" },
  { l: "−", i: "−" },
  { l: "×", i: "×" },
  { l: "÷", i: "÷" },
  { l: "a/b", i: "/" },
  { l: "=", i: "=" },
  { l: "√", i: "√()", o: -1 },
  { l: "x²", i: "²" },
  { l: "x³", i: "³" },
  { l: "xⁿ", i: "^" },
  { l: "π", i: "π" },
  { l: "±", i: "±" },
  { l: "≤", i: "≤" },
  { l: "≥", i: "≥" },
  { l: "≠", i: "≠" },
  { l: "( )", i: "()", o: -1 },
  { l: "|x|", i: "||", o: -1 },
];

export default function MathToolbar({ taRef, value, setValue }) {
  function insertSym(ins, off = 0) {
    const ta = taRef.current;
    if (!ta) return;
    const s = ta.selectionStart ?? value.length;
    const e = ta.selectionEnd ?? value.length;
    setValue(value.slice(0, s) + ins + value.slice(e));
    requestAnimationFrame(() => {
      ta.focus();
      const pos = s + ins.length + off;
      ta.setSelectionRange(pos, pos);
    });
  }

  return (
    <div className="flex flex-wrap gap-1 mb-2">
      {MATH_BUTTONS.map((b) => (
        <button
          key={b.l}
          type="button"
          onClick={() => insertSym(b.i, b.o || 0)}
          className="px-2.5 py-1 rounded-md bg-black/5 hover:bg-black/10 text-sm font-mono"
        >
          {b.l}
        </button>
      ))}
    </div>
  );
}
