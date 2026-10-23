import React, { forwardRef, useState } from 'react';
import { cn } from '../../utils/cn';

export type InputVariant = 'bordered' | 'ghost' | 'filled' | 'underlined';
export type InputShape = 'rounded' | 'normal';

export interface TextInputProps extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    'type'
> {
    type?: 'text' | 'email' | 'number' | 'search' | 'tel' | 'url' | 'password';
    variant?: InputVariant;
    shape?: InputShape;
    label?: string;
    helperText?: string;
    error?: string;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    onIconClick?: (
        e?: React.MouseEvent<HTMLButtonElement>
    ) => void | Promise<void>;
}

const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
    (
        {
            type = 'text',
            variant = 'bordered',
            shape = 'normal',
            label,
            helperText,
            error,
            leftIcon,
            rightIcon,
            disabled,
            className = '',
            id,
            onIconClick,
            ...rest
        },
        ref
    ) => {
        const inputId =
            id ||
            (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

        const shapeClasses = {
            normal: 'rounded-lg',
            rounded: 'rounded-full',
        };

        const baseInputStyles =
            'w-full text-sm font-medium transition-all duration-200 outline-none disabled:cursor-not-allowed disabled:opacity-50 placeholder:text-gray-400 text-gray-900';

        const paddingStyles = `
    py-2.5 
    ${leftIcon ? 'pl-10' : shape === 'rounded' ? 'pl-5' : 'pl-3.5'} 
    ${rightIcon ? 'pr-10' : shape === 'rounded' ? 'pr-5' : 'pr-3.5'}
  `;

        const variantStyles: Record<InputVariant, string> = {
            bordered: ` 
      border ${error ? 'border-red-500 focus:ring-red-500/20' : 'border-bg-secondary focus:ring-1 focus:ring-bg-secondary'}
      shadow-xs
    `,
            ghost: `
      bg-transparent 
      border border-transparent 
      ${error ? 'bg-red-50/50 text-red-900' : 'hover:bg-gray-100  focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10'}
    `,
            filled: `
      bg-gray-100 
      border border-transparent 
      ${error ? 'bg-red-50 border-red-500' : 'hover:bg-gray-200/70  focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10'}
    `,
            underlined: `
      bg-transparent 
      !rounded-none border-b-2 
      ${error ? 'border-red-500' : 'border-gray-300  focus:border-blue-500'}
      !px-0 py-2
    `,
        };

        return (
            <div className="w-full flex flex-col gap-1.5">
                {/* Label */}
                {label && (
                    <label
                        htmlFor={inputId}
                        className="text-xs  tracking-wide text-fr-primary/30 uppercase select-none"
                    >
                        {label}
                    </label>
                )}

                {/* Input Container */}
                <div className="relative flex items-center w-full">
                    {/* Left Icon */}
                    {leftIcon && (
                        <div className="absolute left-3.5 flex items-center pointer-events-none text-gray-400">
                            {leftIcon}
                        </div>
                    )}

                    <input
                        ref={ref}
                        id={inputId}
                        type={type}
                        disabled={disabled}
                        className={cn(
                            baseInputStyles,
                            variant !== 'underlined' ? shapeClasses[shape] : '',
                            variantStyles[variant],
                            variant !== 'underlined' ? paddingStyles : '',
                            'placeholder:text-fr-primary/30',
                            className
                        )}
                        {...rest}
                    />

                    {rightIcon && (
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                onIconClick?.(e);
                            }}
                            type="button"
                            className="absolute cursor-pointer right-3.5 flex items-center text-gray-400 hover:text-gray-600 transition-colors z-10"
                        >
                            {rightIcon}
                        </button>
                    )}
                </div>

                {(error || helperText) && (
                    <p
                        className={`text-xs ${error ? 'text-red-500 font-medium' : 'text-gray-500'}`}
                    >
                        {error || helperText}
                    </p>
                )}
            </div>
        );
    }
);

TextInput.displayName = 'TextInput';

export const PasswordInput = forwardRef<HTMLInputElement, TextInputProps>(
    (props, ref) => {
        const [showPassword, setShowPassword] = useState(false);

        return (
            <TextInput
                ref={ref}
                type={showPassword ? 'text' : 'password'}
                onIconClick={() => setShowPassword((prev) => !prev)}
                rightIcon={
                    showPassword ? (
                        // Eye Open Icon
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                            className="size-5"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
                            />
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                            />
                        </svg>
                    ) : (
                        // Eye Closed Icon
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                            className="size-5"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88"
                            />
                        </svg>
                    )
                }
                {...props}
            />
        );
    }
);

export default TextInput;
