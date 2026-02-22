

# Fix 3 Remaining Agenda Issues

## Issue 1: Left Border Color Still Not Visible

**Root cause found**: In `src/index.css` line 118, there is a global rule:
```css
* { @apply border-border; }
```
This applies `border-color: hsl(var(--border))` to every element via the universal selector. This overrides the inline `style={{ borderLeftColor }}` because the CSS `border-color` shorthand from Tailwind's base layer keeps resetting the color.

**Fix**: Use a direct inline `style` that sets `borderLeftColor` with higher priority. The cleanest approach is to remove the conflicting `border` class and apply border styles explicitly:

In `SessionCard.tsx`, change the card div to:
```tsx
<div
  className="rounded-lg bg-card shadow-sm p-4 pl-5 border-t border-r border-b border-border"
  style={{ borderLeft: `4px solid ${typeBorderColors[actType] ?? '#1A56A0'}` }}
>
```

This avoids the `border` shorthand entirely for the left side, using the `style` prop to set both width and color in one declaration, which cannot be overridden by `border-border`.

Also adds `pl-5` (20px left padding) so card content has breathing room from the colored border.

## Issue 2: Interest Counter Always Visible (Show "0")

**Current behavior**: The counter only shows when `interestCount > 0`.

**Fix**: Remove the `interestCount > 0` condition so the star + count always displays, including "0":

```tsx
{/* Always show interest count */}
<span className="flex items-center gap-0.5 text-xs text-muted-foreground shrink-0 mt-0.5">
  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
  {interestCount}
</span>
```

## Issue 3: Date Language Verification

The locale fix from the previous edit (`startsWith('es')`) is already in place. I will take a screenshot after implementing the fixes to confirm it displays "Abr" correctly.

## Files to Modify

| File | Change |
|---|---|
| `src/components/attendee/SessionCard.tsx` | Fix border approach: use `style={{ borderLeft: '4px solid #color' }}` with separate side borders; always show interest counter; add `pl-5` padding |

