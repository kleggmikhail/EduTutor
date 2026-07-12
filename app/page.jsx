"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "../components/Sidebar";
import ApiKeyModal from "../components/ApiKeyModal";
import NameModal from "../components/NameModal";
import TheoryView from "../components/TheoryView";
import PracticeView from "../components/PracticeView";
import TestView from "../components/TestView";
import ProgressView from "../components/ProgressView";
import ThemeModal from "../components/ThemeModal";
import {
  applyThemePref,
  loadThemePref,
  watchSystemTheme,
} from "../lib/theme";
import { t } from "../lib/i18n";
import { supabase } from "../lib/supabaseClient";
import { algebraSeed } from "../lib/seedAlgebra";

export default function Home() {
  const router = useRouter();
  const [session, setSession] = useState(undefined); // undefined = загрузка
  const [lang, setLang] = useState("ru");
  const [showApiKey, setShowApiKey] = useState(false);
  const [showTheme, setShowTheme] = useState(false);
  const [toast, setToast] = useState("");

  const [sidebarWidth, setSidebarWidth] = useState(288);
  const [subjects, setSubjects] = useState([]);
  const [topics, setTopics] = useState([]);
  const [selection, setSelection] = useState(null); // {topicId, section}
  const [modal, setModal] = useState(null); // {type:'subject'} | {type:'topic', subjectId}

  useEffect(() => {
    const saved = localStorage.getItem("edututor_lang");
    if (saved) setLang(saved);
    const w = parseInt(localStorage.getItem("edututor_sidebar_w"), 10);
    if (w >= 200 && w <= 640) setSidebarWidth(w);

    applyThemePref(loadThemePref());
    const unwatch = watchSystemTheme(loadThemePref);

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });
    return () => {
      sub.subscription.unsubscribe();
      unwatch();
    };
  }, []);

  useEffect(() => {
    if (session === null) router.replace("/login");
  }, [session, router]);

  const loadTree = useCallback(async () => {
    if (!session?.user) return;
    const [s, tp] = await Promise.all([
      supabase
        .from("subjects")
        .select("id, name")
        .order("position")
        .order("created_at"),
      supabase
        .from("topics")
        .select("id, subject_id, parent_id, name")
        .order("position")
        .order("created_at"),
    ]);
    if (!s.error) setSubjects(s.data || []);
    if (!tp.error) setTopics(tp.data || []);
  }, [session]);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  async function toggleLang() {
    const next = lang === "ru" ? "en" : "ru";
    setLang(next);
    localStorage.setItem("edututor_lang", next);
    if (session?.user) {
      await supabase
        .from("user_settings")
        .upsert({ user_id: session.user.id, language: next });
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  function comingSoon() {
    setToast(t(lang, "comingSoon"));
    setTimeout(() => setToast(""), 2000);
  }

  async function addSubject(name) {
    const { error } = await supabase
      .from("subjects")
      .insert({ user_id: session.user.id, name });
    if (error) setToast(t(lang, "errorGeneric"));
    loadTree();
  }

  async function addTopic(subjectId, name, parentId = null) {
    const { error } = await supabase.from("topics").insert({
      user_id: session.user.id,
      subject_id: subjectId,
      parent_id: parentId,
      name,
    });
    if (error) setToast(t(lang, "errorGeneric"));
    loadTree();
  }

  async function deleteSubject(id) {
    if (!confirm(t(lang, "confirmDeleteSubject"))) return;
    await supabase.from("subjects").delete().eq("id", id);
    setSelection(null);
    loadTree();
  }

  async function deleteTopic(id) {
    if (!confirm(t(lang, "confirmDeleteTopic"))) return;
    await supabase.from("topics").delete().eq("id", id);
    if (selection?.topicId === id) setSelection(null);
    loadTree();
  }

  // Загрузка стартового предмета «Алгебра» из документа
  async function seedAlgebra() {
    const seed = algebraSeed[lang] || algebraSeed.ru;
    const { data: subj, error } = await supabase
      .from("subjects")
      .insert({ user_id: session.user.id, name: seed.subject })
      .select("id")
      .single();
    if (error || !subj) {
      setToast(t(lang, "errorGeneric"));
      return;
    }
    for (let i = 0; i < seed.topics.length; i++) {
      const tdef = seed.topics[i];
      const { data: parent } = await supabase
        .from("topics")
        .insert({
          user_id: session.user.id,
          subject_id: subj.id,
          name: tdef.name,
          position: i,
        })
        .select("id")
        .single();
      if (parent && tdef.children.length) {
        await supabase.from("topics").insert(
          tdef.children.map((c, j) => ({
            user_id: session.user.id,
            subject_id: subj.id,
            parent_id: parent.id,
            name: c,
            position: j,
          }))
        );
      }
    }
    loadTree();
  }

  // Перетаскивание границы левой панели
  function startResize(e) {
    e.preventDefault();
    const move = (ev) => {
      const w = Math.min(640, Math.max(200, ev.clientX));
      setSidebarWidth(w);
      localStorage.setItem("edututor_sidebar_w", String(w));
    };
    const stop = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", stop);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", stop);
  }

  const selectedTopic = topics.find((x) => x.id === selection?.topicId);
  const selectedSubject = subjects.find(
    (x) => x.id === selectedTopic?.subject_id
  );

  // Полный путь темы (с родителями) — для контекста ИИ и ключа кэша
  function topicPath(topic) {
    const parts = [topic.name];
    let cur = topic;
    while (cur?.parent_id) {
      cur = topics.find((x) => x.id === cur.parent_id);
      if (cur) parts.unshift(cur.name);
    }
    return parts.join(" → ");
  }

  if (!session) {
    return (
      <div className="h-screen flex items-center justify-center opacity-50">
        …
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <Sidebar
        lang={lang}
        width={sidebarWidth}
        userEmail={session.user.email}
        subjects={subjects}
        topics={topics}
        selection={selection}
        onSelect={setSelection}
        onToggleLang={toggleLang}
        onOpenApiKey={() => setShowApiKey(true)}
        onOpenTheme={() => setShowTheme(true)}
        onLogout={logout}
        onComingSoon={comingSoon}
        onNewSubject={() => setModal({ type: "subject" })}
        onNewTopic={(subjectId) => setModal({ type: "topic", subjectId })}
        onDeleteSubject={deleteSubject}
        onDeleteTopic={deleteTopic}
        onSeed={seedAlgebra}
      />

      {/* Перетаскиваемая граница панели */}
      <div
        onMouseDown={startResize}
        className="w-1 shrink-0 cursor-col-resize hover:bg-accent/40 active:bg-accent/60"
        title="⟷"
      />

      {/* Правая рабочая область */}
      <main className="flex-1 overflow-y-auto p-8">
        {selection?.section === "progress" ? (
          <div className="max-w-3xl mx-auto">
            <h1 className="text-2xl font-semibold mb-6">
              {t(lang, "progress")}
            </h1>
            <ProgressView lang={lang} subjects={subjects} topics={topics} />
          </div>
        ) : selection && selectedTopic ? (
          <div className="max-w-2xl mx-auto">
            <div className="text-sm opacity-60 mb-2">
              {selectedSubject?.name} · {selectedTopic.name}
            </div>
            <h1 className="text-2xl font-semibold mb-4">
              {t(lang, selection.section)}
            </h1>
            {selection.section === "theory" ? (
              <TheoryView
                lang={lang}
                subjectName={selectedSubject?.name || ""}
                topicName={topicPath(selectedTopic)}
              />
            ) : selection.section === "practice" ? (
              <PracticeView
                key={selectedTopic.id + lang}
                lang={lang}
                subjectName={selectedSubject?.name || ""}
                topicPath={topicPath(selectedTopic)}
                topicId={selectedTopic.id}
              />
            ) : selection.section === "test" ? (
              <TestView
                key={selectedTopic.id + lang + "test"}
                lang={lang}
                subjectName={selectedSubject?.name || ""}
                topicPath={topicPath(selectedTopic)}
                topicId={selectedTopic.id}
              />
            ) : (
              <p className="opacity-70">{t(lang, "contentSoon")}</p>
            )}
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="max-w-md text-center">
              <h1 className="text-2xl font-semibold mb-3">
                {t(lang, "welcomeTitle")}
              </h1>
              <p className="opacity-70">{t(lang, "welcomeTreeText")}</p>
            </div>
          </div>
        )}
      </main>

      {showApiKey && (
        <ApiKeyModal lang={lang} onClose={() => setShowApiKey(false)} />
      )}

      {showTheme && (
        <ThemeModal lang={lang} onClose={() => setShowTheme(false)} />
      )}

      {modal && (
        <NameModal
          lang={lang}
          placeholderKey={
            modal.type === "subject" ? "subjectNamePh" : "topicNamePh"
          }
          onCreate={(name) =>
            modal.type === "subject"
              ? addSubject(name)
              : addTopic(modal.subjectId, name)
          }
          onClose={() => setModal(null)}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-ink text-white text-sm px-4 py-2 rounded-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
