import { cn } from '@client/lib/utils';

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('h-4 w-4 shrink-0', className)}
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

export function NoPhiBanner() {
  return (
    <div
      role="alert"
      className="sticky top-0 z-50 flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
    >
      <ShieldIcon />
      <span className="font-medium">No PHI:</span>
      <span>Do not enter patient names, DOB, MRN, or other identifiers</span>
    </div>
  );
}
