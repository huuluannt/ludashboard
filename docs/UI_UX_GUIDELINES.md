# UI/UX Guidelines

LuDashboard is designed to feel like a premium, modern macOS productivity application, not a standard webpage. Keep these guidelines in mind when updating the UI.

## Reference Applications
- **Linear**
- **Notion**
- **Arc Browser**
- **Raycast**

## Visual Philosophy
- **Premium, Elegant, Minimal**: The interface should be spacious and clean.
- **White/Light Gray Dominance**: Use a white background with very light gray surfaces (`var(--color-surface-subtle)`) to separate sections.
- **Subtle Accents**: Use the primary accent color (`#4361ee`) sparingly. Only for active states, primary buttons, or focus rings.
- **Subtle Borders & Shadows**: Use 1px borders with very light colors (`var(--color-border-subtle)`). Use micro-shadows, not deep, heavy box-shadows.

## Typography
- **Font**: Google Inter (or system-ui).
- **Hierarchy**: Use font weight (e.g., 500, 600) and color (primary text vs. tertiary text) to establish hierarchy rather than vastly different font sizes.
- **Anti-aliasing**: macOS font smoothing is applied globally to keep text crisp.

## Spacing Philosophy
- Use Tailwind spacing scales logically.
- Modules should feel spacious. Give content breathing room. Padding of `p-6` or `p-8` for main module wrappers is preferred.
- Compact UI is reserved strictly for the App Shell (Sidebar lists, Tab bar) to maximize real estate for the module.

## Interaction & Desktop-Like UX
- **Hover States**: Every clickable element MUST have a subtle hover state (background color change or opacity shift).
- **Active States**: Use subtle scale transforms (`active:scale-[0.98]`) for buttons and cards.
- **Focus Rings**: Keyboards users must see a crisp focus ring. Use `focus-visible`.
- **Text Selection**: Disable text selection (`select-none`) on all layout controls (tabs, sidebars, buttons). Allow text selection ONLY inside actual module content or inputs.
- **Animations**: Keep animations extremely fast. `< 200ms`. Smooth sidebar collapse, subtle upward dropdown animations.

## Component Specific Rules
- **Tab Bar (`TopRightPane`)**: Must be slim (`h-10`). Active tab blends into the white background below it. Inactive tabs are gray. Tabs must support drag-and-drop reordering.
- **Sidebar (`LeftPane`)**: Must transition smoothly when collapsing. Account dropdown MUST open upwards to avoid clipping off the bottom of the screen.

## What NOT to Do Visually
- ❌ Do not use heavy gradients.
- ❌ Do not use neon or highly saturated generic colors (plain red, plain green). Use tailored HSL variants.
- ❌ Do not create "childish" or oversized UI elements.
- ❌ Do not leave default browser scrollbars. (Custom webkit scrollbars are defined in `index.css`).
