"use client";

// ペナルティマスタの CRUD UI。
// QuestMasterClient と同じレイアウト・操作感で、対象＝複数チェックの many-to-many。

import { useEffect, useState, useTransition } from "react";
import { createPenalty, deletePenalty, updatePenalty } from "../actions";

type Row = {
  id: string;
  title: string;
  description: string | null;
  coinAmount: number;
  emoji: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  targetUserIds: string[];
  targetUserNames: string;
};

type Props = {
  initialRows: Row[];
  kids: { id: string; name: string }[];
};

type FormState = {
  mode: "create" | "edit";
  editingId: string | null;
  title: string;
  description: string;
  coinAmount: number;
  emoji: string;
  targetUserIds: string[];
};

const EMPTY_FORM: FormState = {
  mode: "create",
  editingId: null,
  title: "",
  description: "",
  coinAmount: 50,
  emoji: "🚨",
  targetUserIds: [],
};

function formatDate(iso: string) {
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}/${mm}/${dd}`;
}

export function PenaltyMasterClient({ initialRows, kids }: Props) {
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
      coinAmount: row.coinAmount,
      emoji: row.emoji,
      targetUserIds: row.targetUserIds,
    });
  };

  const closeForm = () => {
    setForm(null);
    setError(null);
  };

  const toggleTarget = (kidId: string) => {
    if (!form) return;
    setForm({
      ...form,
      targetUserIds: form.targetUserIds.includes(kidId)
        ? form.targetUserIds.filter((id) => id !== kidId)
        : [...form.targetUserIds, kidId],
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setError(null);

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      coinAmount: Number(form.coinAmount),
      emoji: form.emoji.trim() || undefined,
      targetUserIds: form.targetUserIds,
    };

    startTransition(async () => {
      const result =
        form.mode === "create"
          ? await createPenalty(payload)
          : await updatePenalty(form.editingId!, payload);

      if (!result.success) {
        setError(result.error);
        return;
      }

      const p = result.penalty;
      const targetNames =
        p.targetUserIds.length > 0
          ? kids
              .filter((k) => p.targetUserIds.includes(k.id))
              .map((k) => k.name)
              .join(", ")
          : "全員";

      if (form.mode === "create") {
        setRows((prev) => [
          ...prev,
          {
            id: p.id,
            title: p.title,
            description: p.description,
            coinAmount: p.coinAmount,
            emoji: p.emoji,
            isActive: p.isActive,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            targetUserIds: p.targetUserIds,
            targetUserNames: targetNames,
          },
        ]);
        setToast(`✅ 「${p.title}」を登録しました`);
      } else {
        setRows((prev) =>
          prev.map((r) =>
            r.id === p.id
              ? {
                  ...r,
                  title: p.title,
                  description: p.description,
                  coinAmount: p.coinAmount,
                  emoji: p.emoji,
                  isActive: p.isActive,
                  updatedAt: new Date().toISOString(),
                  targetUserIds: p.targetUserIds,
                  targetUserNames: targetNames,
                }
              : r,
          ),
        );
        setToast(`✅ 「${p.title}」を更新しました`);
      }
      setForm(null);
    });
  };

  const handleDelete = (row: Row) => {
    if (!window.confirm(`「${row.title}」を削除します。よろしいですか？`))
      return;
    setDeletingId(row.id);
    startTransition(async () => {
      const result = await deletePenalty(row.id);
      setDeletingId(null);
      if (!result.success) {
        setError(result.error ?? "削除に失敗しました");
        return;
      }
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      setToast(`🗑️ 「${row.title}」を削除しました`);
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-slate-300">
          登録ペナルティ：
          <span className="ml-1 font-mono text-rose-300">{rows.length}</span> 件
        </div>
        <button
          type="button"
          onClick={openNew}
          disabled={!!form}
          className="rounded-lg bg-rose-500 px-4 py-2 text-sm font-extrabold text-white shadow-sm transition hover:bg-rose-400 active:bg-rose-600 disabled:cursor-not-allowed disabled:bg-slate-600"
        >
          ＋ 新規ペナルティ登録
        </button>
      </div>

      {form && (
        <form
          onSubmit={handleSubmit}
          className="space-y-3 rounded-xl border border-rose-400/30 bg-slate-900/60 p-4 shadow-lg"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-rose-200">
              {form.mode === "create"
                ? "新規ペナルティ登録"
                : "ペナルティ編集"}
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
                placeholder="🚨"
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
                placeholder="例：けんか"
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-base text-slate-50 focus:border-rose-400 focus:outline-none"
              />
            </label>

            <label className="block text-xs text-slate-300">
              没収コイン <span className="text-rose-400">*</span>
              <input
                type="number"
                min={10}
                max={10000}
                step={10}
                value={form.coinAmount}
                onChange={(e) =>
                  setForm({
                    ...form,
                    coinAmount: Math.max(
                      10,
                      Math.min(10000, Number(e.target.value) || 10),
                    ),
                  })
                }
                required
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-right font-mono text-base text-rose-300 focus:border-rose-400 focus:outline-none"
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
              placeholder="例：きょうだいげんかをしたとき"
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-rose-400 focus:outline-none"
            />
          </label>

          <div>
            <p className="mb-1 text-xs text-slate-300">
              対象の子供
              <span className="ml-2 text-[10px] text-slate-500">
                （誰も選ばないと「全員」用）
              </span>
            </p>
            <div className="flex flex-wrap gap-2">
              {kids.map((kid) => {
                const checked = form.targetUserIds.includes(kid.id);
                return (
                  <button
                    key={kid.id}
                    type="button"
                    onClick={() => toggleTarget(kid.id)}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-bold transition ${
                      checked
                        ? "border-rose-400 bg-rose-500/20 text-rose-100"
                        : "border-slate-500/40 bg-slate-800/40 text-slate-300 hover:bg-slate-700/60"
                    }`}
                  >
                    {checked ? "✓ " : ""}
                    {kid.name}
                  </button>
                );
              })}
            </div>
          </div>

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
              className="rounded-lg bg-rose-500 px-4 py-2 text-sm font-extrabold text-white shadow-sm transition hover:bg-rose-400 disabled:opacity-50"
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

      <div className="overflow-hidden rounded-xl border border-slate-600/40 bg-slate-900/40 shadow-inner">
        <table className="w-full text-sm">
          <thead className="bg-slate-900/60 text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-3 py-2 text-center">絵文字</th>
              <th className="px-3 py-2 text-left">タイトル / 説明</th>
              <th className="px-3 py-2 text-right">没収</th>
              <th className="px-3 py-2 text-left">対象</th>
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
                  ペナルティが登録されていません。「＋ 新規ペナルティ登録」から追加してください。
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
                  <span className="font-mono text-rose-300">
                    -{row.coinAmount}
                  </span>
                </td>
                <td className="px-3 py-3 text-xs text-slate-300">
                  {row.targetUserNames}
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
        <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
          {toast}
        </p>
      )}
    </div>
  );
}
