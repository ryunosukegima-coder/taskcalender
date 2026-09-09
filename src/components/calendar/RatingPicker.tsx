const LEVELS = [1, 2, 3, 4, 5];

interface Props {
  value: number | null;
  onChange: (value: number | null) => void;
  label: string;
}

// Shared 1–5 picker for both urgency and importance. Clicking the already
// selected number clears it back to "not set" rather than requiring a
// separate clear control.
export default function RatingPicker({ value, onChange, label }: Props) {
  return (
    <div className="rating-picker" role="group" aria-label={label}>
      {LEVELS.map((level) => (
        <button
          key={level}
          type="button"
          className={`rating-picker-button${value === level ? " rating-picker-button--active" : ""}`}
          aria-pressed={value === level}
          onClick={() => onChange(value === level ? null : level)}
        >
          {level}
        </button>
      ))}
    </div>
  );
}
