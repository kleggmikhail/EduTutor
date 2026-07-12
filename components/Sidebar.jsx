"use client";

import { useEffect, useState } from "react";
import { t } from "../lib/i18n";

const SECTIONS = ["theory", "practice", "test"];

export default function Sidebar({
  lang,
  userEmail,
  subjects,
  topics,
  selection,
  onSelect,
  onToggleLang,
  onOpenApiKey,
  onLogout,
  onComingSoon,
  onNewSubject,
  onNewTopic,
  onDeleteSubject,
  onDeleteTopic,
  onSeed,
}) {
  const item =
    "w-full text-left px-3 py-2 rounded-lg hover:bg-black/5 transition text-sm";
  const [openSubjects, setOpenSubjects] = useState({});
  const [openTopics, setOpenTopics] = useState({});
  const [ctx, setCtx] = useState(null); // {x, y, kind, id}

  useEffect(() => {
    const close = () => setCtx(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  function contextMenu(e, kind, id) {
    e.preventDefault();
    e.stopPropagation();
    setCtx({ x: e.clientX, y: e.clientY, kind, id });
  }

  function TopicNode({ topic, depth }) {
    const children = topics.filter((x) => x.parent_id === topic.id);
    const open = !!openTopics[topic.id];
    return (
      <div>
        <button
          className={`${item} truncate`}
          style={{ paddingLeft: 12 + depth * 14 }}
          onClick={() =>
            setOpenTopics((s) => ({ ...s, [topic.id]: !s[topic.id] }))
          }
          onContextMenu={(e) => contextMenu(e, "topic", topic.id)}
        >
          {open ? "▾" : "▸"} {topic.name}
        </button>
        {open && (
          <div>
            {children.map((c) => (
              <TopicNode key={c.id} topic={c} depth={depth + 1} />
            ))}
            {SECTIONS.map((s) => {
              const active =
                selection?.topicId === topic.id && selection?.section === s;
              return (
                <button
                  key={s}
                  className={`${item} ${active ? "bg-black/10" : ""}`}
                  style={{ paddingLeft: 26 + depth * 14 }}
                  onClick={() => onSelect({ topicId: topic.id, section: s })}
                >
                  {t(lang, s)}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <aside className="w-72 shrink-0 h-screen bg-sidebar border-r border-black/10 flex flex-col">
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
        <button className={item} onClick={onNewSubject}>
          {t(lang, "newSubject")}
        </button>
        <button className={item} onClick={onComingSoon}>
          {t(lang, "progress")}
        </button>
      </nav>

      <div className="mx-4 my-3 border-t border-black/10" />

      {/* Нижняя часть: дерево предметов */}
      <div className="px-4 text-xs uppercase tracking-wide opacity-60 mb-1">
        {t(lang, "subjects")}
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {subjects.length === 0 && (
          <div className="px-2 py-2 text-sm opacity-60">
            {t(lang, "noSubjects")}
            <button
              className="mt-2 w-full text-left px-3 py-2 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 text-sm"
              onClick={onSeed}
            >
              {t(lang, "addSample")}
            </button>
          </div>
        )}

        {subjects.map((subj) => {
          const open = !!openSubjects[subj.id];
          const rootTopics = topics.filter(
            (x) => x.subject_id === subj.id && !x.parent_id
          );
          return (
            <div key={subj.id}>
              <button
                className={`${item} font-medium truncate`}
                onClick={() =>
                  setOpenSubjects((s) => ({ ...s, [subj.id]: !s[subj.id] }))
                }
                onContextMenu={(e) => contextMenu(e, "subject", subj.id)}
              >
                {open ? "▾" : "▸"} {subj.name}
              </button>
              {open && (
                <div>
                  <button
                    className={`${item} pl-6 text-accent`}
                    onClick={() => onNewTopic(subj.id)}
                  >
                    {t(lang, "newTopic")}
                  </button>
                  {rootTopics.map((topic) => (
                    <TopicNode key={topic.id} topic={topic} depth={1} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Контекстное меню: удалить */}
      {ctx && (
        <div
          className="fixed z-50 bg-white border border-black/10 rounded-lg shadow-lg py-1"
          style={{ left: ctx.x, top: ctx.y }}
        >
          <button
            className="px-4 py-2 text-sm text-red-700 hover:bg-black/5 w-full text-left"
            onClick={() => {
              if (ctx.kind === "subject") onDeleteSubject(ctx.id);
              else onDeleteTopic(ctx.id);
              setCtx(null);
            }}
          >
            {t(lang, "delete")}
          </button>
        </div>
      )}
    </aside>
  );
}
