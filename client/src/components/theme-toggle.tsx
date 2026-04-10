import { cn } from '@client/lib/utils';
import { useTheme } from '@client/components/theme-provider';

export function ThemeToggle() {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <div className="flex items-center justify-between px-3 py-1.5">
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground select-none">
        {isDark ? (
          /* Moon icon */
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5"
            aria-hidden="true"
          >
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        ) : (
          /* Sun icon */
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5"
            aria-hidden="true"
          >
            <circle cx={12} cy={12} r={5} />
            <line x1={12} y1={1} x2={12} y2={3} />
            <line x1={12} y1={21} x2={12} y2={23} />
            <line x1={4.22} y1={4.22} x2={5.64} y2={5.64} />
            <line x1={18.36} y1={18.36} x2={19.78} y2={19.78} />
            <line x1={1} y1={12} x2={3} y2={12} />
            <line x1={21} y1={12} x2={23} y2={12} />
            <line x1={4.22} y1={19.78} x2={5.64} y2={18.36} />
            <line x1={18.36} y1={5.64} x2={19.78} y2={4.22} />
          </svg>
        )}
        {isDark ? 'Dark' : 'Light'}
      </span>

      {/* Pill toggle */}
      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        onClick={toggleTheme}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full',
          'transition-colors duration-200 ease-in-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
          isDark
            ? 'bg-primary'
            : 'bg-muted-foreground/30',
        )}
      >
        <span
          className={cn(
            'pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-md',
            'transition-transform duration-200 ease-in-out',
            isDark ? 'translate-x-[18px]' : 'translate-x-[3px]',
          )}
        />
      </button>
    </div>
  );
}
