import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

import {
  createBranch,
  deleteBranch,
  listBranches,
  type Branch,
  type BranchPayload,
  updateBranch
} from "../api/adminBranchesApi";
import { uploadMedia } from "../api/adminMediaApi";

type BranchForm = {
  name: string;
  address: string;
  services: string;
  phone: string;
  latitude: string;
  longitude: string;
  imageUrl: string;
};

const emptyForm: BranchForm = {
  name: "",
  address: "",
  services: "Sunday 9:00 AM, Wednesday 6:00 PM",
  phone: "+254700000000",
  latitude: "-1.286389",
  longitude: "36.817223",
  imageUrl: "https://images.unsplash.com/photo-1519491050282-cf00c82424b4?q=80&w=900"
};

function toForm(branch: Branch): BranchForm {
  return {
    name: branch.name,
    address: branch.address,
    services: branch.services,
    phone: branch.phone,
    latitude: String(branch.latitude),
    longitude: String(branch.longitude),
    imageUrl: branch.imageUrl || ""
  };
}

function toPayload(form: BranchForm): BranchPayload {
  return {
    name: form.name.trim(),
    address: form.address.trim(),
    services: form.services.trim(),
    phone: form.phone.trim(),
    latitude: Number(form.latitude),
    longitude: Number(form.longitude),
    imageUrl: form.imageUrl.trim()
  };
}

export function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [form, setForm] = useState<BranchForm>({ ...emptyForm });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) return branches;

    return branches.filter(branch =>
      [branch.name, branch.address, branch.services, branch.phone]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [branches, query]);

  async function load() {
    setLoading(true);
    setError("");

    try {
      const response = await listBranches();
      setBranches(response.branches || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load branches");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function updateField<K extends keyof BranchForm>(key: K, value: BranchForm[K]) {
    setForm(current => ({
      ...current,
      [key]: value
    }));
  }

  function resetForm() {
    setEditingId(null);
    setForm({ ...emptyForm });
  }

  function startEdit(branch: Branch) {
    setEditingId(branch.id);
    setForm(toForm(branch));
  }

  async function uploadImage(file: File | null) {
    if (!file) return;

    setUploadingImage(true);
    setError("");

    try {
      const response = await uploadMedia("image", file);
      updateField("imageUrl", response.media.path || response.media.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload branch image");
    } finally {
      setUploadingImage(false);
    }
  }

  function validate() {
    const latitude = Number(form.latitude);
    const longitude = Number(form.longitude);

    if (!form.name.trim()) return "Name is required.";
    if (!form.address.trim()) return "Address is required.";
    if (!form.services.trim()) return "Services are required.";
    if (!form.phone.trim()) return "Phone is required.";

    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      return "Latitude must be between -90 and 90.";
    }

    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      return "Longitude must be between -180 and 180.";
    }

    return "";
  }

  async function submit(event: FormEvent) {
    event.preventDefault();

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = toPayload(form);

      if (editingId) {
        await updateBranch(editingId, payload);
      } else {
        await createBranch(payload);
      }

      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save branch");
    } finally {
      setSaving(false);
    }
  }

  async function remove(branch: Branch) {
    const confirmed = confirm(`Delete "${branch.name}"?`);
    if (!confirmed) return;

    setSaving(true);
    setError("");

    try {
      await deleteBranch(branch.id);
      await load();

      if (editingId === branch.id) {
        resetForm();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete branch");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main>
      <header className="page-header">
        <div>
          <p className="eyebrow">Content</p>
          <h1>Branches</h1>
          <p className="muted">
            Manage church branches, contact details, service times, and map coordinates.
          </p>
        </div>

        <button className="secondary" onClick={load}>
          Refresh
        </button>
      </header>

      {error ? <div className="error">{error}</div> : null}

      <section className="content-grid">
        <form className="editor-card" onSubmit={submit}>
          <div className="section-title-row">
            <h2>{editingId ? "Edit Branch" : "Create Branch"}</h2>

            {editingId ? (
              <button type="button" className="secondary compact" onClick={resetForm}>
                Cancel
              </button>
            ) : null}
          </div>

          <label>
            Name
            <input
              value={form.name}
              onChange={event => updateField("name", event.target.value)}
              placeholder="Shekinah Sons Global - Main Campus"
            />
          </label>

          <label>
            Address
            <input
              value={form.address}
              onChange={event => updateField("address", event.target.value)}
              placeholder="Nairobi, Kenya"
            />
          </label>

          <label>
            Services
            <textarea
              value={form.services}
              onChange={event => updateField("services", event.target.value)}
              placeholder="Sunday 9:00 AM, Wednesday 6:00 PM"
              rows={3}
            />
          </label>

          <label>
            Phone
            <input
              value={form.phone}
              onChange={event => updateField("phone", event.target.value)}
              placeholder="+254700000000"
            />
          </label>

          <div className="two-col">
            <label>
              Latitude
              <input
                value={form.latitude}
                onChange={event => updateField("latitude", event.target.value)}
                placeholder="-1.286389"
              />
            </label>

            <label>
              Longitude
              <input
                value={form.longitude}
                onChange={event => updateField("longitude", event.target.value)}
                placeholder="36.817223"
              />
            </label>
          </div>

          <label>
            Image URL
            <input
              value={form.imageUrl}
              onChange={event => updateField("imageUrl", event.target.value)}
              placeholder="/uploads/media/image.png or https://..."
            />
          </label>

          <label>
            Upload Image
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={uploadingImage}
              onChange={async event => {
                await uploadImage(event.target.files?.[0] || null);
                event.target.value = "";
              }}
            />
          </label>

          {uploadingImage ? (
            <p className="muted">Uploading image...</p>
          ) : null}

          <button disabled={saving}>
            {saving ? "Saving..." : editingId ? "Update Branch" : "Create Branch"}
          </button>
        </form>

        <section className="list-card">
          <div className="section-title-row">
            <h2>Existing Branches</h2>
            <span className="count-pill">{filtered.length}</span>
          </div>

          <input
            className="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search branches..."
          />

          {loading ? (
            <p className="muted">Loading branches...</p>
          ) : filtered.length === 0 ? (
            <p className="muted">No branches found.</p>
          ) : (
            <div className="sermon-list">
              {filtered.map(branch => (
                <article key={branch.id} className="sermon-row">
                  <div>
                    <h3>{branch.name}</h3>
                    <p>{branch.address}</p>
                    <p className="small-muted">{branch.services}</p>
                    <p className="small-muted">
                      {branch.phone} · {branch.latitude}, {branch.longitude}
                    </p>
                  </div>

                  <div className="row-actions">
                    <button className="secondary compact" onClick={() => startEdit(branch)}>
                      Edit
                    </button>

                    <button className="danger compact" onClick={() => remove(branch)}>
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
