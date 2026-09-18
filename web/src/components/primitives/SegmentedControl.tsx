import { useLayoutEffect, useRef } from 'react';
import { VISUALLY_HIDDEN } from './styles';

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
  const fieldsetRef = useRef<HTMLFieldSetElement>(null);
  const thumbRef = useRef<HTMLSpanElement>(null);
  const buttonRefs = useRef(new Map<T, HTMLButtonElement>());
  const hasMountedRef = useRef(false);

  useLayoutEffect(() => {
    const fieldset = fieldsetRef.current;
    const thumb = thumbRef.current;
    const activeButton = buttonRefs.current.get(value);
    if (!fieldset || !thumb || !activeButton) return;

    const positionThumb = () => {
      thumb.style.transition = hasMountedRef.current ? '' : 'none';
      thumb.style.width = `${activeButton.offsetWidth}px`;
      thumb.style.transform = `translateX(${activeButton.offsetLeft}px)`;
      if (!hasMountedRef.current) {
        // Force layout so the "no transition" style commits before it is
        // cleared, otherwise the browser can coalesce it away and the
        // first placement animates in from the fieldset's origin.
        thumb.getBoundingClientRect();
        hasMountedRef.current = true;
      }
    };

    positionThumb();

    const observer = new ResizeObserver(positionThumb);
    observer.observe(fieldset);
    return () => observer.disconnect();
  }, [value, options]);

  return (
    <fieldset className="mc-segmented" ref={fieldsetRef}>
      <legend style={VISUALLY_HIDDEN}>{label}</legend>
      <span ref={thumbRef} className="mc-segment-thumb" aria-hidden="true" />
      {options.map((option) => (
        <button
          key={option}
          type="button"
          className="mc-segment"
          aria-pressed={option === value}
          disabled={disabled}
          ref={(el) => {
            if (el) buttonRefs.current.set(option, el);
            else buttonRefs.current.delete(option);
          }}
          onClick={() => onChange(option)}
        >
          {format(option)}
        </button>
      ))}
    </fieldset>
  );
}
