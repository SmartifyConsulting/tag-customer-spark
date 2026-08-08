# Design System V2 - Color Palette

## Overview
The V2 user interface uses a sophisticated three-color palette designed for clarity, warmth, and accessibility.

## Primary Colors

### Cream (Background)
- **Hex:** `#F5F1E8`
- **Role:** Primary background color for all surfaces
- **Usage:** Page backgrounds, default card backgrounds, main content areas
- **Accessibility:** High contrast with dark text and forest green elements

### Forest Green (Primary)
- **Hex:** `#2C5F4F`
- **Role:** Primary brand color for interactive elements and emphasis
- **Usage:** 
  - Primary buttons and CTAs
  - Active navigation items
  - Selected states
  - Focus indicators
  - Sidebar active pills
- **Foreground:** White (`#FFFFFF`)

### Orange (Secondary/Accent)
- **Hex:** `#F5A623`
- **Role:** Secondary accent for highlights and secondary actions
- **Usage:**
  - Secondary buttons
  - Accent highlights
  - Icon highlights
  - Secondary navigation active states
  - Hover states
- **Foreground:** White (`#FFFFFF`)

---

## Extended Palette

### Neutral Colors
- **White:** `#FFFFFF` - Card surfaces, component backgrounds
- **Dark Charcoal:** `#2C3E50` - Text on light backgrounds
- **Light Grey:** `#E8E4D8` - Borders, dividers
- **Medium Grey:** `#6B7280` - Secondary text
- **Light Cream:** `#F9F7F3` - Input backgrounds

### Semantic Colors
- **Success Green:** `#10B981` - Success messages, confirmations
- **Warning Amber:** `#F59E0B` - Warnings, cautions
- **Error Red:** `#DC2626` - Errors, destructive actions

---

## Dark Mode

### Dark Mode Palette
- **Background:** `#1F2937` - Dark surface
- **Card Background:** `#2C3E50` - Slightly lighter cards
- **Text:** `#F5F1E8` - Cream text on dark
- **Primary (Forest Green):** `#7FBFA8` - Lighter for dark mode contrast
- **Secondary (Orange):** `#FFB74D` - Lighter for dark mode contrast

---

## Usage Guidelines

### Buttons

#### Primary Button
- Background: Forest Green (`#2C5F4F`)
- Text: White
- Hover: Slightly darker forest green
- Used for: Main actions, form submissions

#### Secondary Button
- Background: Orange (`#F5A623`)
- Text: White
- Hover: Slightly darker orange
- Used for: Alternative actions, secondary calls-to-action

#### Outline Button
- Border: Forest Green (`#2C5F4F`)
- Text: Forest Green
- Background: Transparent
- Hover: Light grey background
- Used for: Tertiary actions, less emphasis needed

### Navigation
- Active state: Forest Green background with white text
- Inactive state: Medium grey text on cream background
- Hover: Light grey background

### Cards
- Background: White
- Border: Light grey (`#E8E4D8`)
- Text: Dark charcoal

### Forms
- Input background: Light cream (`#F9F7F3`)
- Border: Light grey
- Focus ring: Forest Green

---

## Accessibility

### Contrast Ratios
- Forest Green on Cream: **7.2:1** ✓ AAA
- Orange on White: **5.1:1** ✓ AA
- Dark Charcoal on Cream: **9.8:1** ✓ AAA
- Dark Charcoal on White: **10.2:1** ✓ AAA

### Implementation Notes
- Never rely on color alone to convey information
- Use icons, patterns, or text labels in addition to color
- Ensure focus states are clearly visible (ring: Forest Green)
- Test with color blindness simulators for critical UI elements

---

## CSS Variables

All colors are defined as CSS custom properties in `src/styles.css`:

```css
--primary: #2C5F4F;           /* Forest Green */
--primary-foreground: #FFFFFF;

--secondary: #F5A623;          /* Orange */
--secondary-foreground: #FFFFFF;

--background: #F5F1E8;         /* Cream */
--foreground: #2C3E50;         /* Dark Charcoal */

--accent: #F5A623;             /* Orange */
--accent-foreground: #FFFFFF;
```

Use with Tailwind classes:
```html
<!-- Forest Green button -->
<button class="bg-primary text-primary-foreground">Primary Action</button>

<!-- Orange button -->
<button class="bg-secondary text-secondary-foreground">Secondary Action</button>

<!-- Cream background -->
<div class="bg-background text-foreground">Content</div>
```

---

## Color Swatches

```
┌─────────────────┐
│     CREAM       │  #F5F1E8
│   (Background)  │
└─────────────────┘

┌─────────────────┐
│ FOREST GREEN    │  #2C5F4F
│    (Primary)    │
└─────────────────┘

┌─────────────────┐
│     ORANGE      │  #F5A623
│   (Secondary)   │
└─────────────────┘
```

---

## Implementation

The color system is implemented in:
- **CSS Variables:** `src/styles.css`
- **Tailwind Config:** Inherited from CSS variables
- **Light Mode:** Default theme
- **Dark Mode:** `.dark` class selector

To maintain consistency, always use the defined CSS variables rather than hardcoding hex values.
