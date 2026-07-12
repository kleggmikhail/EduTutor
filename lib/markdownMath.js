import { marked } from "marked";
import katex from "katex";

// Markdown → HTML с формулами, отрисованными сразу через KaTeX.
// 1) прячем формулы в плейсхолдеры (marked ломает \, _, *),
// 2) парсим markdown,
// 3) на место плейсхолдеров вставляем готовый HTML KaTeX.
// Никакой пост-обработки DOM не требуется — результат стабилен
// при любых перерисовках React.

function renderMathSegment(seg) {
  let displayMode = false;
  let body = seg;
  if (seg.startsWith("$$") && seg.endsWith("$$")) {
    displayMode = true;
    body = seg.slice(2, -2);
  } else if (seg.startsWith("\\[") && seg.endsWith("\\]")) {
    displayMode = true;
    body = seg.slice(2, -2);
  } else if (seg.startsWith("\\(") && seg.endsWith("\\)")) {
    body = seg.slice(2, -2);
  } else if (seg.startsWith("$") && seg.endsWith("$")) {
    body = seg.slice(1, -1);
  }
  try {
    return katex.renderToString(body, { displayMode, throwOnError: false });
  } catch {
    return seg
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
}

export function mdWithMath(md) {
  const store = [];
  const stash = (m) => {
    store.push(m);
    return `XMATHX${store.length - 1}XENDX`;
  };

  let s = String(md || "");
  s = s
    .replace(/\$\$[\s\S]+?\$\$/g, stash)
    .replace(/\\\[[\s\S]+?\\\]/g, stash)
    .replace(/\\\([\s\S]+?\\\)/g, stash)
    .replace(/\$[^$\n]+?\$/g, stash);

  let html = marked.parse(s);

  html = html.replace(/XMATHX(\d+)XENDX/g, (_, i) =>
    renderMathSegment(store[+i])
  );
  return html;
}
