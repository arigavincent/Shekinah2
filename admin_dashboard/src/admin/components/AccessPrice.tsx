export function AccessPrice({
  price,
  onChange,
  label = "Access",
  disabled = false,
}: {
  price: number;
  onChange: (price: number) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <fieldset className="access-choice" disabled={disabled}>
      <legend>{label}</legend>
      <div className="segmented-control" aria-label={label}>
        <button type="button" aria-pressed={price === 0} onClick={() => onChange(0)}>
          Free
        </button>
        <button type="button" aria-pressed={price > 0} onClick={() => onChange(price || 1)}>
          Paid
        </button>
      </div>
      {price > 0 ? (
        <label>
          Price (KSh)
          <input
            type="number"
            required
            min="1"
            max="1000000"
            step="1"
            value={price}
            onChange={(e) => onChange(Math.max(1, Number(e.target.value)))}
          />
        </label>
      ) : (
        <p className="small-muted">Available without payment.</p>
      )}
    </fieldset>
  );
}
