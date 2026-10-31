export type Question = {
  id: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[];
};
export type RegistrationSetup = {
  mode: string;
  formUrl: string;
  price: number;
  capacity: number;
  fields: Question[];
};
export const emptyRegistration: RegistrationSetup = {
  mode: "form",
  formUrl: "",
  price: 0,
  capacity: 0,
  fields: [],
};
export function RegistrationFields({
  value,
  onChange,
}: {
  value: RegistrationSetup;
  onChange: (value: RegistrationSetup) => void;
}) {
  const patch = (fields: Partial<RegistrationSetup>) => onChange({ ...value, ...fields });
  const edit = (index: number, fields: Partial<Question>) =>
    patch({ fields: value.fields.map((q, i) => (i === index ? { ...q, ...fields } : q)) });
  return (
    <>
      <div className="two-col">
        <label>
          Registration
          <select value={value.mode} onChange={(e) => patch({ mode: e.target.value })}>
            <option value="form">Custom in-app form</option>
            <option value="link">External form (Google Forms or another HTTPS form)</option>
            <option value="none">No registration form</option>
          </select>
        </label>
        <label>
          Capacity (0 = unlimited)
          <input
            type="number"
            min="0"
            step="1"
            value={value.capacity}
            onChange={(e) => patch({ capacity: Number(e.target.value) })}
          />
        </label>
      </div>
      {value.mode === "link" && (
        <>
          <label>
            External form URL
            <input
              type="url"
              value={value.formUrl}
              onChange={(e) => patch({ formUrl: e.target.value })}
              placeholder="https://docs.google.com/forms/…"
            />
          </label>
          <p className="small-muted">
            External responses stay with the form provider. Paid tickets still require confirmed
            payment in Shekinah.
          </p>
        </>
      )}
      {value.mode === "form" && (
        <>
          <h3>Custom questions</h3>
          {value.fields.map((q, i) => (
            <div className="queue-item" key={q.id}>
              <div className="two-col">
                <label>
                  Question {i + 1}
                  <input
                    maxLength={200}
                    value={q.label}
                    onChange={(e) => edit(i, { label: e.target.value })}
                  />
                </label>
                <label>
                  Answer type
                  <select value={q.type} onChange={(e) => edit(i, { type: e.target.value })}>
                    {[
                      ["text", "Short answer"],
                      ["longtext", "Paragraph"],
                      ["phone", "Phone"],
                      ["email", "Email"],
                      ["number", "Number"],
                      ["choice", "Multiple choice"],
                    ].map(([v, t]) => (
                      <option key={v} value={v}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {q.type === "choice" && (
                <label>
                  Options (one per line)
                  <textarea
                    value={(q.options || []).join("\n")}
                    onChange={(e) => edit(i, { options: e.target.value.split("\n") })}
                  />
                </label>
              )}
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={q.required}
                  onChange={(e) => edit(i, { required: e.target.checked })}
                />
                Required
              </label>
              <button
                type="button"
                className="secondary compact"
                onClick={() => patch({ fields: value.fields.filter((_, n) => n !== i) })}
              >
                Remove question
              </button>
            </div>
          ))}
          <button
            type="button"
            className="secondary compact"
            disabled={value.fields.length >= 20}
            onClick={() =>
              patch({
                fields: [
                  ...value.fields,
                  { id: crypto.randomUUID(), label: "", type: "text", required: false },
                ],
              })
            }
          >
            Add question
          </button>
        </>
      )}
    </>
  );
}
