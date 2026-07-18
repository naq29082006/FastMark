---
name: Vietnamese Local Marketplace
colors:
  surface: '#f8f9ff'
  surface-dim: '#d0dbed'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e6eeff'
  surface-container-high: '#dee9fc'
  surface-container-highest: '#d9e3f6'
  on-surface: '#121c2a'
  on-surface-variant: '#3e4a3d'
  inverse-surface: '#27313f'
  inverse-on-surface: '#eaf1ff'
  outline: '#6e7b6c'
  outline-variant: '#bdcaba'
  surface-tint: '#006e2d'
  primary: '#006b2c'
  on-primary: '#ffffff'
  primary-container: '#00873a'
  on-primary-container: '#f7fff2'
  inverse-primary: '#62df7d'
  secondary: '#006e2f'
  on-secondary: '#ffffff'
  secondary-container: '#6bff8f'
  on-secondary-container: '#007432'
  tertiary: '#735c00'
  on-tertiary: '#ffffff'
  tertiary-container: '#cea700'
  on-tertiary-container: '#4e3e00'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#7ffc97'
  primary-fixed-dim: '#62df7d'
  on-primary-fixed: '#002109'
  on-primary-fixed-variant: '#005320'
  secondary-fixed: '#6bff8f'
  secondary-fixed-dim: '#4ae176'
  on-secondary-fixed: '#002109'
  on-secondary-fixed-variant: '#005321'
  tertiary-fixed: '#ffe083'
  tertiary-fixed-dim: '#eec200'
  on-tertiary-fixed: '#231b00'
  on-tertiary-fixed-variant: '#574500'
  background: '#f8f9ff'
  on-background: '#121c2a'
  surface-variant: '#d9e3f6'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '400'
    lineHeight: 30px
  body-md:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  label-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  label-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 20px
  price-display:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-margin: 24px
  gutter: 16px
  touch-target-min: 56px
  stack-gap-lg: 32px
  stack-gap-md: 16px
---

## Brand & Style

This design system is built for accessibility, reliability, and cultural familiarity. The target audience includes elderly users and local vendors who require high legibility and an intuitive interface that mirrors the warmth of a traditional Vietnamese "Chợ Quê" (country market).

The design style is **Modern Minimalist with Humanist touches**. It prioritizes clarity over ornamentation, utilizing heavy whitespace to reduce cognitive load and large, high-contrast elements to ensure ease of use for those with varying levels of digital literacy. The emotional response should be one of "An Tâm" (peace of mind) and "Tiện Lợi" (convenience).

**Core Principles:**
- **Extreme Simplicity:** One primary action per screen.
- **Elderly-Friendly:** Minimum touch targets of 48px, high-contrast text ratios, and recognizable iconography.
- **Familiarity:** Use of traditional green tones to evoke freshness and organic produce.

## Colors

The palette is anchored in nature-inspired greens to represent the freshness of marketplace goods. 

- **Primary (#16A34A):** Used for critical actions, headers, and active states. It meets WCAG AA standards for contrast against white backgrounds.
- **Secondary (#22C55E):** Used for accents, secondary buttons, and success indicators.
- **Tertiary (#FACC15):** A vibrant yellow used sparingly for "Hot Deals" or price highlights, reminiscent of traditional market signage.
- **Neutral (#1F2937):** A deep charcoal for text to ensure maximum readability against the white background.
- **Background (#FFFFFF):** Pure white is used to keep the interface feeling clean and spacious.

## Typography

Typography is the most critical element for this design system. We use **Inter** for its exceptional legibility and modern, neutral feel.

- **Size Matters:** The minimum font size for body text is 18px. Avoid anything smaller than 16px to accommodate elderly vision.
- **Visual Hierarchy:** Use bold weights (700) for headers and prices to ensure they are the first thing a user sees.
- **Line Height:** Generous line heights are used to prevent text from feeling cramped.
- **Vietnamese Support:** Ensure the specific diacritics of the Vietnamese language are clear and not cut off by tight line heights.

## Layout & Spacing

The layout follows a **Fluid Grid** model with high-margin safety zones. 

- **Grid:** A 4-column grid for mobile and 12-column for desktop.
- **Margins:** A wide 24px side margin on mobile provides a "safety area" for thumbs and prevents the UI from feeling cluttered.
- **Vertical Rhythm:** Elements are separated by large gaps (32px for sections, 16px for related items) to clearly distinguish between different pieces of information.
- **Touch Targets:** All interactive elements (buttons, inputs, toggles) must have a minimum height of 56px to accommodate less precise motor skills.

## Elevation & Depth

To maintain simplicity, this design system avoids complex shadows and heavy layers.

- **Tonal Layers:** We use subtle off-white or very light gray (#F9FAFB) backgrounds for container cards to separate them from the main background.
- **Low-Contrast Outlines:** Use 1px borders in a soft gray (#E5E7EB) for input fields and cards.
- **Interactive State:** When a button is pressed, it should visually "sink" or darken slightly rather than using a complex shadow change.
- **Flat Depth:** Most elements should remain flat to minimize visual noise. Depth is communicated through color fills rather than shadows.

## Shapes

The shape language is **Rounded**, conveying a friendly, approachable, and safe environment.

- **Radius:** Standard components use a 0.5rem (8px) radius. 
- **Large Components:** Cards and main action containers use 1rem (16px) to feel distinct and "soft" to the touch.
- **Icons:** Icons should feature rounded caps and corners to match the UI's friendliness. Avoid sharp points.

## Components

### Buttons
- **Primary Action:** Large (56px+ height), full-width buttons with white text on Primary Green. Use `headline-md` for button labels.
- **Secondary Action:** Ghost style with Primary Green border and text.
- **Visual Cues:** Include a right-pointing arrow icon (→) on primary navigation buttons to suggest forward movement.

### Cards (Sản phẩm)
- Product cards must have a large image (at least 40% of card area).
- Price should be prominently displayed in red (#DC2626) at the bottom right.
- Add "Chọn mua" (Select to buy) buttons directly on the card to reduce steps.

### Input Fields
- Labels must always be visible (no floating labels that disappear).
- Use large text within inputs.
- Success/Error states must use both color and icons (Checkmark/Warning) for accessibility.

### Lists
- Each list item should be separated by a clear 1px divider.
- Increased vertical padding (20px top/bottom) to ensure each row is a large touch target.

### Clear Iconography
- Use thick-stroke icons (2pt or 3pt) from a consistent library like Lucide or Heroicons.
- Icons should always be accompanied by text labels. Never rely on an icon alone to convey meaning.