import type { ReactNode } from "react";

type BulkCsvImportCardProps = {
  title: string;
  description: string;
  templateFilename: string;
  templateHeaders: string[];
  csvValue: string;
  pastePlaceholder: string;
  disabled?: boolean;
  canImport?: boolean;
  onCsvChange: (value: string) => void;
  onPreview: () => void;
  onImport: () => void;
  onLoadFile: (file: File | null) => Promise<void> | void;
  children?: ReactNode;
};

function downloadCsvTemplate(filename: string, headers: string[]) {
  const csv = `${headers.join(",")}\n`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

export function BulkCsvImportCard({
  title,
  description,
  templateFilename,
  templateHeaders,
  csvValue,
  pastePlaceholder,
  disabled = false,
  canImport = false,
  onCsvChange,
  onPreview,
  onImport,
  onLoadFile,
  children
}: BulkCsvImportCardProps) {
  return (
    <details className="csv-import-panel">
      <summary>
        <div>
          <span className="csv-import-kicker">Bulk tools</span>
          <strong>{title}</strong>
          <p>{description}</p>
        </div>
        <span className="csv-import-toggle">Open</span>
      </summary>

      <div className="csv-import-body">
        <div className="csv-import-actions">
          <button
            type="button"
            className="secondary compact"
            onClick={() => downloadCsvTemplate(templateFilename, templateHeaders)}
            disabled={disabled}
          >
            Download Template
          </button>

          <label className="csv-file-button">
            <span>Choose CSV File</span>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={async event => {
                await onLoadFile(event.target.files?.[0] || null);
                event.target.value = "";
              }}
              disabled={disabled}
            />
          </label>

          <button type="button" className="secondary compact" onClick={onPreview} disabled={disabled}>
            Preview
          </button>

          <button type="button" className="compact" onClick={onImport} disabled={disabled || !canImport}>
            Import
          </button>
        </div>

        <textarea
          className="csv-import-textarea"
          value={csvValue}
          onChange={event => onCsvChange(event.target.value)}
          rows={7}
          placeholder={pastePlaceholder}
        />

        {children}
      </div>
    </details>
  );
}
