---
description: UI component standards — Shadcn UI, Tailwind, accessibility, No-PHI banner
globs:
  - "client/src/components/**/*.tsx"
  - "client/src/pages/**/*.tsx"
  - "client/src/layouts/**/*.tsx"
---

# UI Component Standards

## Component Library

- Use **Shadcn UI** (Radix primitives) as the base component library.
- Import from `@client/components/ui/` — never install raw Radix packages directly.
- Extend Shadcn components via Tailwind's `cn()` utility, not inline style overrides.

## Styling

- **Tailwind CSS v3** utility-first classes. No custom CSS files unless absolutely necessary.
- Use Tailwind's design tokens (spacing, colors, typography) for consistency.
- Responsive: mobile-first breakpoints (`sm:`, `md:`, `lg:`).

## Animations

- Use **Framer Motion** for transitions and animations.
- Keep animations subtle and purposeful — no decorative motion that slows UX.

## Drag and Drop

- Use `@hello-pangea/dnd` for Kanban board drag-and-drop.
- Ensure drag handles are keyboard-accessible.

## No-PHI Banner

- Every authenticated page MUST render the No-PHI banner.
- The banner is persistent and cannot be dismissed by users.
- Never use patient health information in placeholder text, mock data, or example content.

## Accessibility

- All interactive elements must be keyboard-navigable.
- Use semantic HTML (`button`, `nav`, `main`, `section`) over generic `div` soup.
- Shadcn/Radix components handle most ARIA attributes — don't override them unless fixing a specific issue.

## Charts & Data Viz

- Use **Recharts** for dashboard charts and reporting visualizations.
- Ensure chart colors meet contrast requirements.
