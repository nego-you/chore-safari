"use client";

// クエストマスタの CRUD UI。
// 上部に「＋ 新規クエスト登録」ボタン → クリックでインラインフォームが開く。
// 一覧行の ✏️ 編集を押すと、同じフォームに値を流し込んで更新モードに。

import { useEffect, useState, useTransition } from "react";
import { createQuest, deleteQuest, updateQuest } from "../actions";

type Row = {
  id: string;
  title: string;
  description: string | null;
  rewardCoins: number;
  emoji: string;
  isActive: boolean;
  submissionCount: number;
  createdAt: string;
  updatedAt: string;
};

type Props = {
  initialRows: Row[];
};

type FormState = {
  mode: "create" | "edit";
  editingId: string | null;
  title: string;
  description: string;
  rewardCoins: number;
  emoji: string;
};

const EMPTY_FORM: FormState = {
  mode: "create",
  editingId: null,
  title: "",
  description: "",
  rewardCoins: 50,
  emoji: "⭐",
};

function formatDate(iso: string) {
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}/${mm}/${dd}`;
}

export function QuestMasterClient({ initialRows }: Props) {
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => setRows(initialRows), [initialRows]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const openNew = () => {
    setError(null);
    setForm({ ...EMPTY_FORM });
  };

  const openEdit = (row: Row) => {
    setError(null);
    setForm({
      mode: "edit",
      editingId: row.id,
      title: row.title,
      description: row.description ?? "",
      rewardCoins: row.rewardCoins,
      emoji: row.emoji,
    });
  };

  const closeForm = () => {
    setForm(null);
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setError(null);

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      rewardCoins: Number(form.rewardCoins),
      emoji: form.emoji.trim() || undefined,
    };

    startTransition(async () => {
      const result =
        form.mode === "create"
          ? await createQuest(payload)
          : await updateQuest(form.editingId!, payload);

      if (!result.success) {
        setError(result.error);
        return;
      }

      const q = result.quest;
      if (form.mode === "create") {
        setRows((prev) => [
          ...prev,
          {
            id: q.id,
            title: q.title,
            description: q.description,
            rewardCoins: q.rewardCoins,
            emoji: q.emoji,
            isActive: q.isActive,
            submissionCount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ]);
        setToast(`✅ 「${q.title}」を登録しました`);
      } else {
        setRows((prev) =>
          prev.map((r) =>
            r.id === q.id
              ? {
                  ...r,
                  title: q.title,
                  description: q.description,
                  rewardCoins: q.rewardCoins,
                  emoji: q.emoji,
                  isActive: q.isActive,
                  updatedAt: new Date().toISOString(),
                }
              : r,
          ),
        );
        setToast(`✅ 「${q.title}」を更新しました`);
      }
      setForm(null);
    });
  };

  const handleDelete = (row: Row) => {
    const msg =
      row.submissionCount > 0
        ? `「${row.title}」を削除します。関連する申請履歴 ${row.submissionCount} 件も一緒に消えます。よろしいですか？`
        : `「${row.title}」を削除します。よろしいですか？`;
    if (!window.confirm(msg)) return;

    setDeletingId(row.id);
    startTransition(async () => {
      const result = await deleteQuest(row.id);
      setDeletingId(null);
      if (!result.success) {
        setError(result.error ?? "削除に失敗しました");
        return;
      }
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      setToast(
        `🗑️ 「${row.title}」を削除しました${
          result.deletedSubmissions
            ? `（申請履歴 ${result.deletedSubmissions} 件も削除）`
            : ""
        }`,
      );
    });
  };

  return (
    <div className="space-y-5">
      {/* ヘッダ操作 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-slate-300">
          登録クエスト：
          <span className="ml-1 font-mono text-emerald-300">{rows.length}</span>{" "}
          件
        </div>
        <button
          type="button"
          onClick={openNew}
          disabled={!!form}
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-extrabold text-white shadow-sm transition hover:bg-emerald-400 active:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-600"
        >
          ＋ 新規クエスト登録
        </button>
      </div>

      {/* インラインフォーム */}
      {form && (
        <form
          onSubmit={handleSubmit}
          className="space-y-3 rounded-xl border border-emerald-400/30 bg-slate-900/60 p-4 shadow-lg"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-emerald-200">
              {form.mode === "create" ? "新規クエスト登録" : "クエスト編集"}
            </p>
            <button
              type="button"
              onClick={closeForm}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              閉じる ✕
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-[80px_1fr_140px]">
            <label className="block text-xs text-slate-300">
              絵文字
              <input
                type="text"
                value={form.emoji}
                onChange={(e) =>
                  setForm({ ...form, emoji: e.target.value.slice(0, 4) })
                }
                placeholder="⭐"
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-center text-2xl"
              />
            </label>

            <label className="block text-xs text-slate-300">
              タイトル <span className="text-rose-400">*</span>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
                maxLength={80}
                placeholder="例：おふろそうじ"
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-base text-slate-50 focus:border-emerald-400 focus:outline-none"
              />
            </label>

            <label className="block text-xs text-slate-300">
              報酬コイン <span className="text-rose-400">*</span>
              <input
                type="number"
                min={1}
                max={10000}
                step={5}
                value={form.rewardCoins}
                onChange={(e) =>
                  setForm({
                    ...form,
                    rewardCoins: Math.max(
                      1,
                      Math.min(10000, Number(e.target.value) || 0),
                    ),
                  })
                }
                required
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-right font-mono text-base text-emerald-300 focus:border-emerald-400 focus:outline-none"
              />
            </label>
          </div>

          <label className="block text-xs text-slate-300">
            説明（任意）
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              maxLength={400}
              rows={2}
              placeholder="例：おふろを ピカピカに してね"
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none"
            />
          </label>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={closeForm}
              className="rounded-lg border border-slate-500/50 px-4 py-2 text-sm font-bold text-slate-300 hover:bg-slate-800"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-extrabold text-white shadow-sm transition hover:bg-emerald-400 disabled:opacity-50"
            >
              {isPending
                ? "保存中…"
                : form.mode === "create"
                  ? "登録する"
                  : "更新する"}
            </button>
          </div>

          {error && (
            <p className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {error}
            </p>
          )}
        </form>
      )}

      {/* 一覧テーブル */}
      <div className="overflow-hidden rounded-xl border border-slate-600/40 bg-slate-900/40 shadow-inner">
        <table className="w-full text-sm">
          <thead className="bg-slate-900/60 text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-3 py-2 text-center">絵文字</th>
              <th className="px-3 py-2 text-left">タイトル / 説明</th>
              <th className="px-3 py-2 text-right">報酬</th>
              <th className="px-3 py-2 text-right">申請</th>
              <th className="px-3 py-2 text-left">更新日</th>
              <th className="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/60 text-slate-100">
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-8 text-center text-sm text-slate-400"
                >
                  クエストが登録されていません。「＋ 新規クエスト登録」から追加してください。
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr
                key={row.id}
                className={`align-top ${
                  deletingId === row.id ? "opacity-50" : ""
                }`}
              >
                <td className="px-3 py-3 text-center text-2xl">{row.emoji}</td>
                <td className="px-3 py-3">
                  <div className="font-bold">{row.title}</div>
                  {row.description && (
                    <div className="mt-0.5 text-xs text-slate-400">
                      {row.description}
                    </div>
                  )}
                </td>
                <td className="px-3 py-3 text-right">
                  <span className="font-mono text-amber-200">
                    +{row.rewardCoins}
                  </span>
                </td>
                <td className="px-3 py-3 text-right text-xs text-slate-400">
                  {row.submissionCount}
                </td>
                <td className="px-3 py-3 text-xs text-slate-400">
                  {formatDate(row.updatedAt)}
                </td>
                <td className="px-3 py-3">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(row)}
                      disabled={isPending}
                      className="rounded-lg border border-sky-400/30 bg-sky-500/10 px-3 py-1.5 text-xs font-bold text-sky-200 transition hover:bg-sky-500/20 disabled:opacity-50"
                    >
                      ✏️ 編集
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(row)}
                      disabled={isPending}
                      className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-50"
                    >
                      🗑️ 削除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {toast && (
        <p className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
          {toast}
        </p>
      )}
    </div>
  );
}
