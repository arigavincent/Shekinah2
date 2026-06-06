type PlaceholderPageProps = {
  title: string;
  description: string;
};

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <main>
      <header className="page-header">
        <div>
          <p className="eyebrow">Coming Next</p>
          <h1>{title}</h1>
          <p className="muted">{description}</p>
        </div>
      </header>

      <section className="empty-panel">
        <h2>{title} Management</h2>
        <p>
          This section is planned for the next admin module. The sidebar route now works,
          but CRUD has not been implemented yet.
        </p>
      </section>
    </main>
  );
}
