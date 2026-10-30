import {DateTimeField} from "./DateTimeFields";
import { BookOpen } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiRequest } from "../api/client";
import { getToken } from "../auth/session";
import { localRelease, PublishingQueue } from "./PublishingQueue";
import { releaseISO, uploadCoverImage } from "../publishing/queue";
import { AccessPrice } from "./AccessPrice";
type Book = {
  publishedAt: string;
  notifyOnPublish: boolean;
  id: string;
  title: string;
  author: string;
  description: string;
  category: string;
  kind: string;
  price: number;
  isPublished: boolean;
  canEdit: boolean;
  sales: number;
  coverUrl: string;
  encrypted: boolean;
};
function MaterialCover({ url, title }: { url: string; title: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  return url && !failed ? (
    <img
      className="cover-preview"
      src={url}
      alt={`${title} cover`}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  ) : (
    <span className="cover-placeholder" aria-hidden="true">
      <BookOpen size={26} />
    </span>
  );
}
export function SecureLibraryPane() {
  const [books, setBooks] = useState<Book[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all");
  const [edit, setEdit] = useState<Book | null>(null),
    [cover, setCover] = useState<File | null>(null),
    [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{ items: Book[] }>("/api/v1/library", { token: getToken() });
      setBooks(res.items.filter((b) => b.canEdit));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load books");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  function patch(fields: Partial<Book>) {
    setEdit((e) => (e ? { ...e, ...fields } : e));
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!edit) return;
    setBusy(true);
    setError("");
    try {
      const coverUrl = cover ? await uploadCoverImage(cover) : undefined;
      await apiRequest(`/api/v1/library/${edit.id}`, {
        method: "PATCH",
        token: getToken(),
        body: {
          title: edit.title,
          author: edit.author,
          description: edit.description,
          category: edit.category,
          price: edit.price,
          publishedAt: releaseISO(edit.publishedAt),
          isPublished: edit.isPublished,
          notifyOnPublish: edit.notifyOnPublish,
          ...(coverUrl ? { coverUrl } : {}),
        },
      });
      setEdit(null);
      setCover(null);
      setNotice("Changes saved. The app and web use the same library.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save book");
    } finally {
      setBusy(false);
    }
  }
  async function visibility(book: Book) {
    setBusy(true);
    setError("");
    try {
      await apiRequest(`/api/v1/library/${book.id}`, {
        method: "PATCH",
        token: getToken(),
        body: { isPublished: !book.isPublished },
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update visibility");
    } finally {
      setBusy(false);
    }
  }
  const visible = books.filter(
    (b) =>
      (!query ||
        [b.title, b.author, b.category].join(" ").toLowerCase().includes(query.toLowerCase())) &&
      (filter === "all" ||
        (filter === "paid" && b.price > 0) ||
        (filter === "free" && b.price === 0) ||
        (filter === "draft" && !b.isPublished)),
  );
  return (
    <>
      <PublishingQueue section="book" onCompleted={load} />
      <section className="list-card" aria-label="Books and materials">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">Member library</p>
            <h2>Books & materials</h2>
          </div>
          <button className="secondary" onClick={() => void load()} disabled={loading}>
            Refresh
          </button>
        </div>
        {error && <p role="alert">{error}</p>}
        {notice && <p role="status">{notice}</p>}
        <div className="two-col">
          <label>
            Search
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Title, author or category"
            />
          </label>
          <label>
            Access / status
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All materials</option>
              <option value="free">Free</option>
              <option value="paid">Paid</option>
              <option value="draft">Drafts / hidden</option>
            </select>
          </label>
        </div>
        {edit && (
          <form className="editor-card" onSubmit={submit}>
            <h2>Edit material</h2>
            <label>
              Title
              <input
                required
                maxLength={160}
                value={edit.title}
                onChange={(e) => patch({ title: e.target.value })}
              />
            </label>
            <div className="two-col">
              <label>
                Author
                <input value={edit.author} onChange={(e) => patch({ author: e.target.value })} />
              </label>
              <label>
                Category
                <input
                  value={edit.category}
                  onChange={(e) => patch({ category: e.target.value })}
                />
              </label>
<DateTimeField label="Release · Nairobi" value={edit.publishedAt} onChange={v=>patch({publishedAt:releaseISO(v)})} allowNow/>
            </div>
            <label>
              Description
              <textarea
                value={edit.description}
                onChange={(e) => patch({ description: e.target.value })}
              />
            </label>
            <AccessPrice
              price={edit.price}
              onChange={(price) => patch({ price })}
              disabled={!edit.encrypted}
            />
            {!edit.encrypted && (
              <p className="small-muted">
                This older material uses a public file link. Publish a protected PDF before charging
                for it.
              </p>
            )}
            {edit.coverUrl && <MaterialCover url={edit.coverUrl} title={edit.title} />}
            <label>
              Replace cover (optional)
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setCover(e.target.files?.[0] || null)}
              />
            </label>
            <p className="small-muted">
              A supplied cover overrides the generated cover. Leave this empty to keep the existing
              cover.
            </p>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={edit.isPublished}
                onChange={(e) => patch({ isPublished: e.target.checked })}
              />
              Publish at release time
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={edit.notifyOnPublish}
                onChange={(e) => patch({ notifyOnPublish: e.target.checked })}
              />
              Notify members
            </label>
            <div className="row-actions">
              <button disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
              <button
                type="button"
                className="secondary"
                onClick={() => setEdit(null)}
                disabled={busy}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
        {loading ? (
          <p role="status">Loading materials…</p>
        ) : !visible.length ? (
          <p className="muted">No materials found.</p>
        ) : (
          <div className="item-list">
            {visible.map((book) => (
              <article className="item-row" key={book.id}>
                <MaterialCover url={book.coverUrl} title={book.title} />
                <div>
                  <h3>{book.title}</h3>
                  <p>
                    {book.author} · {book.category || book.kind}
                  </p>
                  <p className="muted">
                    <span className="status-chip">
                      {book.price ? `Paid · KSh ${book.price.toLocaleString()}` : "Free"}
                    </span>{" "}
                    ·{" "}
                    {!book.isPublished
                      ? "Draft / hidden"
                      : new Date(book.publishedAt).getTime() > Date.now()
                        ? "Scheduled"
                        : "Published"}{" "}
                    · {book.sales || 0} confirmed purchases
                  </p>
                </div>
                <div className="row-actions">
                  <button
                    className="secondary compact"
                    disabled={busy}
                    onClick={() => {
                      setEdit({ ...book });
                      setCover(null);
                      setNotice("");
                    }}
                  >
                    Edit
                  </button>
                  <button
                    className="secondary compact"
                    disabled={busy}
                    onClick={() => void visibility(book)}
                  >
                    {book.isPublished ? "Hide" : "Publish"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
