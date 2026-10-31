import { useRef, type InputHTMLAttributes } from "react";
import { CalendarDays, Clock3 } from "lucide-react";
import { nairobiNow, releaseISO } from "../publishing/queue";
type PickerProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
} & Pick<InputHTMLAttributes<HTMLInputElement>, "min" | "max" | "required" | "disabled">;
function Picker({
  type,
  label,
  value,
  onChange,
  hint,
  ...rest
}: PickerProps & { type: "date" | "time" }) {
  const input = useRef<HTMLInputElement>(null),
    Icon = type === "date" ? CalendarDays : Clock3;
  function open() {
    try {
      input.current?.showPicker();
    } catch {
      input.current?.focus();
    }
  }
  return (
    <label className="calendar-field">
      <span>{label}</span>
      <span className="calendar-control">
        <input
          {...rest}
          ref={input}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onClick={open}
        />
        <button
          type="button"
          className="secondary picker-button"
          onClick={open}
          disabled={rest.disabled}
          aria-label={`Choose ${label.toLowerCase()}`}
        >
          <Icon size={18} aria-hidden="true" />
        </button>
      </span>
      {hint && <small className="small-muted">{hint}</small>}
    </label>
  );
}
export function DateField(props: PickerProps) {
  return <Picker {...props} type="date" />;
}
export function TimeField(props: PickerProps) {
  let value = props.value;
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(value.trim());
  if (match) {
    const h = (Number(match[1]) % 12) + (match[3].toUpperCase() === "PM" ? 12 : 0);
    value = `${String(h).padStart(2, "0")}:${match[2]}`;
  }
  return <Picker {...props} value={value} type="time" />;
}
export function localDateTime(value: string) {
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return value;
  const d = new Date(value);
  return Number.isFinite(d.getTime())
    ? new Date(d.getTime() + 10800000).toISOString().slice(0, 16)
    : "";
}
export function DateTimeField({
  label,
  value,
  onChange,
  disabled = false,
  allowNow = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  allowNow?: boolean;
}) {
  const local = localDateTime(value),
    date = local.slice(0, 10),
    time = local.slice(11, 16);
  return (
    <fieldset className="datetime-picker" disabled={disabled}>
      <legend>{label}</legend>
      <div className="two-col">
        <DateField
          label="Date"
          value={date}
          onChange={(d) => {
            if (d) onChange(`${d}T${time || "10:00"}`);
          }}
          required
        />
        <TimeField
          label="Time · Nairobi"
          value={time}
          onChange={(t) => {
            if (t) onChange(`${date || nairobiNow().slice(0, 10)}T${t}`);
          }}
          required
        />
      </div>
      {allowNow && (
        <button type="button" className="secondary compact" onClick={() => onChange(nairobiNow())}>
          Now
        </button>
      )}
    </fieldset>
  );
}
export function PublicationTiming({
  publishNow,
  onMode,
  value,
  onChange,
}: {
  publishNow: boolean;
  onMode: (now: boolean) => void;
  value: string;
  onChange: (value: string) => void;
}) {
  function later() {
    if (!value || new Date(releaseISO(value)).getTime() <= Date.now())
      onChange(localDateTime(new Date(Date.now() + 3600000).toISOString()));
    onMode(false);
  }
  return (
    <section className="publication-timing" aria-label="Publication timing">
      <div className="segmented-control">
        <button type="button" aria-pressed={publishNow} onClick={() => onMode(true)}>
          Publish now
        </button>
        <button type="button" aria-pressed={!publishNow} onClick={later}>
          Schedule for later
        </button>
      </div>
      {publishNow ? (
        <p className="small-muted">
          Upload now. The item becomes available as soon as its upload finishes.
        </p>
      ) : (
        <>
          <DateTimeField label="Publication date & time" value={value} onChange={onChange} />
          <p className="small-muted">
            Files upload now. Members see them at the chosen time in Africa/Nairobi.
          </p>
        </>
      )}
    </section>
  );
}
