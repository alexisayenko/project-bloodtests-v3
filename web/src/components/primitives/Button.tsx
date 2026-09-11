import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { buttonStyle, type ButtonSize, type ButtonVariant } from './styles';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({ variant, size, type = 'button', disabled, style, ...rest }: Readonly<ButtonProps>) {
  return <button type={type} disabled={disabled} style={{ ...buttonStyle(variant, size, disabled), ...style }} {...rest} />;
}

/** A button-styled label over a hidden file input; the input is cleared after each pick so the same file can be picked again. */
export function FileButton({
  accept,
  onFile,
  disabled,
  variant,
  size,
  style,
  children,
}: Readonly<{
  accept: string;
  onFile: (file: File) => void;
  disabled?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  style?: CSSProperties;
  children: ReactNode;
}>) {
  return (
    <label style={{ ...buttonStyle(variant, size, disabled), ...style }}>
      {children}
      <input
        type="file"
        accept={accept}
        disabled={disabled}
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          if (file) onFile(file);
          e.currentTarget.value = '';
        }}
      />
    </label>
  );
}
