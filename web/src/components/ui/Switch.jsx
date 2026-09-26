import React from 'react';

export default function Switch({
  checked = false,
  onCheckedChange,
  disabled = false,
  className = '',
  id,
  'aria-label': ariaLabel = 'Toggle switch',
  ...props
}) {
  const handleClick = (e) => {
    e.stopPropagation();
    if (!disabled && onCheckedChange) {
      onCheckedChange(!checked);
    }
  };

  const handleKeyDown = (e) => {
    if (disabled) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      onCheckedChange?.(!checked);
    }
  };

  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3970e1]/40 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked
          ? 'bg-[#3970e1]'
          : 'bg-slate-200 dark:bg-slate-700'
      } ${className}`}
      {...props}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition-transform duration-200 ease-in-out ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  );
}
