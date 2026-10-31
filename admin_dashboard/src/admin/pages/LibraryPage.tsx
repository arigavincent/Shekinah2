import { SecureLibraryPane } from "../components/SecureLibraryPane";
export function LibraryPage() {
  return (
    <main>
      <header className="page-header">
        <div>
          <p className="eyebrow">Content</p>
          <h1>Library</h1>
          <p className="muted">
            Publish and manage free or paid books, journals and study materials for the member app.
          </p>
        </div>
      </header>
      <SecureLibraryPane />
    </main>
  );
}
