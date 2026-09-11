export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  format = String,
  disabled = false,
  label,
}: Readonly<{
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  format?: (value: T) => string;
  disabled?: boolean;
  label: string;
}>) {
  return (
    <div role="group" aria-label={label} className="mc-segmented">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          className="mc-segment"
          aria-pressed={option === value}
          disabled={disabled}
          onClick={() => onChange(option)}
        >
          {format(option)}
        </button>
      ))}
    </div>
  );
}
