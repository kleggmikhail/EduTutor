import { marked } from "marked";

// Markdown → HTML с защитой LaTeX-формул.
// marked ломает формулы (\, _, * трактует как разметку), поэтому:
// 1) прячем формулы в плейсхолдеры, 2) парсим markdown, 3) возвращаем формулы.
// Дальше KaTeX auto-render отрисует их в готовом DOM.
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
    store[+i]
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
  );
  return html;
}
