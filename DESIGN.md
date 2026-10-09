---
name: D-Game
colors:
  background: "hsl(0, 0%, 4%)"
  foreground: "hsl(0, 0%, 95%)"
  card: "hsl(0, 0%, 7%)"
  card-foreground: "hsl(0, 0%, 95%)"
  primary: "hsl(0, 0%, 12%)"
  primary-foreground: "hsl(0, 0%, 98%)"
  secondary: "hsl(0, 0%, 15%)"
  secondary-foreground: "hsl(0, 0%, 95%)"
  muted: "hsl(0, 0%, 12%)"
  muted-foreground: "hsl(0, 0%, 65%)"
  accent: "hsl(0, 0%, 18%)"
  accent-foreground: "hsl(0, 0%, 98%)"
  danger: "hsl(348, 83%, 47%)"
  danger-foreground: "hsl(0, 0%, 100%)"
  info: "hsl(199, 89%, 48%)"
  border: "hsl(0, 0%, 15%)"
  input: "hsl(0, 0%, 15%)"
  ring: "hsl(348, 83%, 47%)"
typography:
  font-family-body: "Inter, sans-serif"
  font-family-heading: "Inter, sans-serif"
  body-md:
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "1.5"
  heading-lg:
    fontSize: "32px"
    fontWeight: 700
    lineHeight: "1.2"
shapes:
  rounded-sm: "2px"
  rounded-md: "4px"
  rounded-lg: "8px"
components:
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.danger-foreground}"
    rounded: "{shapes.rounded-md}"
  card-panel:
    backgroundColor: "{colors.card}"
    borderColor: "{colors.border}"
    rounded: "{shapes.rounded-lg}"
---

## Overview
D-Game is a serious, mysterious survival game with psychological tension and competitive depth. The visual identity emphasizes a dark, atmospheric, and tactical HUD-like presentation. It avoids generic SaaS aesthetics, gradients, and heavy animations in favor of strict readability and performance.

## Colors
- **Background (`hsl(0, 0%, 4%)`):** Near-black space for the primary canvas.
- **Card/Surface (`hsl(0, 0%, 7%)`):** Charcoal for elevated panels, differentiating from the absolute background.
- **Danger/Action (`hsl(348, 83%, 47%)`):** Restrained crimson for critical actions, alerts, and primary calls to action.
- **Muted/Borders (`hsl(0, 0%, 15%)`):** Neutral dark grey used for boundaries, disabled states, and secondary visual dividers.
- **Info/Accent (`hsl(199, 89%, 48%)`):** A sharp cyan used sparingly for neutral or non-hostile highlights.

## Typography
- **Primary Font:** `Inter` (sans-serif) for both headings and body to maintain a highly readable, modern, tactical aesthetic.
- **Scale:**
  - Text is generally kept small but highly legible (e.g., `14px` for secondary data, `16px` for primary interactions).
  - Headings are stark and bold, tracking tighter to evoke urgency.

## Layout
- **Breakpoints:** Responsive foundation starting at `320px` (mobile viewport) scaling up to desktop wide bounds.
- **Grid:** Use standard Tailwind Flex/Grid patterns. Content is typically centered with max-widths to prevent horizontal stretching on ultrawide displays.

## Elevation & Depth
- **Borders:** Panels rely on thin, solid 1px borders (`var(--color-border)`) rather than heavy drop shadows to communicate depth.
- **Background Differentiation:** Flat background color changes (`card` vs `background`) rather than gradients or elevation shadows.

## Shapes
- **Radius:** Subtle border radii (`4px` to `8px` maximum). The design is sharp and deliberate; avoid heavy pill shapes or overly rounded dashboard elements.

## Components
- **Buttons (Action):** Solid `danger` background. Hover states slightly reduce opacity (e.g., `opacity-90`). Sharp focus rings (`focus-visible:ring-ring`).
- **Buttons (Ghost/Secondary):** Transparent background with `border`, turning to `accent` background on hover.
- **Inputs:** `input` border over `background` fill. Focus states use the `danger` ring.
- **Status Indicators:** Use minimal text formatting (e.g., `[CLASSIFIED]`) rather than heavily styled badges, emphasizing the raw data feel.

## Do's and Don'ts
- ✅ **DO** maintain high contrast (WCAG AA/AAA) for primary text (`hsl(0, 0%, 95%)`).
- ✅ **DO** use `border` to separate content areas rather than shadows.
- ❌ **DON'T** use gradients, heavy box-shadows, or complex visual filters (backdrop-filter) that harm low-end device performance.
- ❌ **DON'T** use emoji as structural icons; rely on minimal text symbols (e.g., `[ ]`, `?`) or lightweight SVG if necessary.
