"use client";

import { t } from "../lib/i18n";

export default function Sidebar({
  lang,
  userEmail,
  onToggleLang,
  onOpenApiKey,
  onLogout,
  onComingSoon,
}) {
  const item =
    "w-full text-left px-3 py-2 rounded-lg hover:bg-black/5 transition text-sm";

  return (
    <aside className="w-64 shrink-0 h-screen bg-sidebar border-r border-black/10 flex flex-col">
      <div className="px-4 py-4 font-semibold text-lg">{t(lang, "appName")}</div>

      {/* Верхняя часть: меню */}
      <nav className="px-2 space-y-1">
        <button className={item} onClick={onLogout} title={userEmail}>
          {t(lang, "logout")} · {userEmail}
        </button>
        <button className={item} onClick={onToggleLang}>
          {t(lang, "language")}: {lang.toUpperCase()}
        </button>
        <button className={item} onClick={onOpenApiKey}>
          {t(lang, "apiKey")}
        </button>
        <button className={item} onClick={onComingSoon}>
          {t(lang, "newSubject")}
        </button>
        <button className={item} onClick={onComingSoon}>
          {t(lang, "progress")}
        </button>
      </nav>

      <div className="mx-4 my-3 border-t border-black/10" />

      {/* Нижняя часть: дерево предметов (Этап 1) */}
      <div className="px-4 text-xs uppercase tracking-wide opacity-60">
        {t(lang, "subjects")}
      </div>
      <div className="px-4 py-2 text-sm opacity-50">
        {t(lang, "comingSoon")}
      </div>
    </aside>
  );
}
