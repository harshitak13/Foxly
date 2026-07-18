---
name: Foxly
colors:
  surface: '#fdf9f4'
  surface-dim: '#ddd9d5'
  surface-bright: '#fdf9f4'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f7f3ee'
  surface-container: '#f1ede8'
  surface-container-high: '#ebe8e3'
  surface-container-highest: '#e6e2dd'
  on-surface: '#1c1c19'
  on-surface-variant: '#57423a'
  inverse-surface: '#31302d'
  inverse-on-surface: '#f4f0eb'
  outline: '#8b7268'
  outline-variant: '#dec0b5'
  surface-tint: '#a43d02'
  primary: '#a03b00'
  on-primary: '#ffffff'
  primary-container: '#c1531b'
  on-primary-container: '#fffbff'
  inverse-primary: '#ffb597'
  secondary: '#635d59'
  on-secondary: '#ffffff'
  secondary-container: '#eae1db'
  on-secondary-container: '#69635f'
  tertiary: '#386545'
  on-tertiary: '#ffffff'
  tertiary-container: '#507f5c'
  on-tertiary-container: '#f6fff4'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdbcd'
  primary-fixed-dim: '#ffb597'
  on-primary-fixed: '#360f00'
  on-primary-fixed-variant: '#7d2d00'
  secondary-fixed: '#eae1db'
  secondary-fixed-dim: '#cdc5c0'
  on-secondary-fixed: '#1f1b18'
  on-secondary-fixed-variant: '#4b4642'
  tertiary-fixed: '#bcefc5'
  tertiary-fixed-dim: '#a1d2aa'
  on-tertiary-fixed: '#00210d'
  on-tertiary-fixed-variant: '#225031'
  background: '#fdf9f4'
  on-background: '#1c1c19'
  surface-variant: '#e6e2dd'
typography:
  display:
    fontFamily: Hanken Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  mono-code:
    fontFamily: JetBrains Mono
    fontSize: 15px
    fontWeight: '500'
    lineHeight: 24px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  auth-card-max: 440px
  container-padding: 2rem
  stack-gap-lg: 2rem
  stack-gap-md: 1.5rem
  stack-gap-sm: 0.75rem
  grid-gutter: 1.5rem
---

## Brand & Style

The design system is built around the persona of a clever, watchful guardian. It balances the warmth of a consumer-facing product with the precision required for a security platform. The visual narrative avoids the "tech-blue" cliches of the security industry, opting instead for a palette and structure that feels organic and approachable yet sharp and efficient.

The style is **Modern Professional with Organic Warmth**. It utilizes a minimalist layout with focused attention on single-column interactions. The aesthetic is clean and spacious, but avoids being sterile by using warm background tones and sharp, geometric accent shapes inspired by the "fox" motif.

**Emotional Response:**
- **Confidence:** Through bold, clear typography and high-contrast primary actions.
- **Calm:** Through generous whitespace and a soft, non-white background that reduces eye strain.
- **Intelligence:** Through a precise, geometric grid and subtle, clever micro-interactions.

## Colors

This color palette is designed to stand out in the security space while maintaining high accessibility standards.

- **Primary (#D9642C):** Used for main action buttons, active states, and the brand wordmark. It represents the "Fox" and provides a high-energy focal point.
- **Secondary/Dark (#1F1B18):** Used for primary text, deep-layered backgrounds, and high-contrast UI elements. It provides the grounding "charcoal" necessary for a professional feel.
- **Background (#FAF6F1):** A warm off-white used across all page backgrounds to create a tactile, paper-like feel that is softer than pure white.
- **Success (#4A7856):** A muted mossy green used for verified states and successful login confirmations.
- **Warning (#E8A33D):** A warm amber used for low-urgency alerts or pending actions, intentionally avoiding traditional red to reduce user anxiety during the auth process.

## Typography

The typography strategy pairs a sharp, geometric sans-serif for headings with a highly legible humanist sans-serif for body text.

- **Headlines:** Use **Hanken Grotesk** for its sharp terminals and modern, confident stance. It should be used for page titles and section headers to establish authority.
- **Body & Labels:** Use **Inter** for all functional text, inputs, and descriptions. It provides the neutral, systematic clarity required for complex security flows.
- **Technical Content:** **JetBrains Mono** is reserved strictly for backup codes, recovery keys, and device IDs. It should always be displayed with increased letter spacing to ensure character distinction (e.g., distinguishing '0' from 'O').

## Layout & Spacing

The layout philosophy emphasizes focus and reduction of cognitive load.

- **Authentication Flows:** Utilize a centered, single-column "Auth Card" layout limited to a maximum width of 440px. This keeps the user's focus entirely on the input task.
- **Dashboard/Management:** Uses a fluid grid for device management and logs. Items are arranged in high-density lists with clear vertical separation.
- **Spacing Rhythm:** Based on an 8px base unit. 
    - Use `stack-gap-lg` (32px) for separating major sections (e.g., header from form).
    - Use `stack-gap-md` (24px) for spacing between form fields.
    - Use `stack-gap-sm` (12px) for related label-and-input pairs.
- **Mobile Adaptation:** On screens smaller than 640px, the 440px card expands to 100% width with `container-padding` (16px) on the sides.

## Elevation & Depth

This design system uses **Tonal Layering** and **Subtle Shadows** to define hierarchy without clutter.

- **Surface Tiers:**
    - **Level 0 (Base):** The warm off-white (#FAF6F1) background.
    - **Level 1 (Card):** White (#FFFFFF) surfaces used for the main auth card and list items, featuring a very soft, large-radius shadow (15% opacity of the Charcoal color).
    - **Level 2 (Interactive):** Elements like borders or active inputs use color fills or subtle 2px offsets to indicate "pressability."
- **Outlines:** Use low-contrast 1px borders (#E5E1DC) for input fields and list separators to maintain structure without creating visual noise.
- **Motion:** Use a "Fox-paw" motif as a loading state—a sequence of four small geometric pads appearing in a rhythmic walking pattern.

## Shapes

The shape language is "Soft Geometric." It mirrors the mascot's sharp-yet-friendly nature.

- **Primary Radius:** 0.5rem (8px). Used for buttons, input fields, and small cards.
- **Large Radius:** 1rem (16px). Used for the main Auth Card container.
- **Sharp Details:** While containers are rounded, icons and the mascot use sharp, 45-degree angles and geometric precision to convey the "sharp-eared" alertness of the brand.

## Components

- **Buttons:** 
    - **Primary:** Solid Fox-Red (#D9642C) with White text. Bold weight. Minimal 2px lift on hover.
    - **Secondary:** Transparent with Charcoal outline and text. 
- **Input Fields:** Large touch targets (48px height minimum). Use a 1px border that thickens to 2px in Fox-Red when focused. Labels should always be persistent (not floating) for clarity.
- **Auth Cards:** Centered, white background, 16px corner radius, soft ambient shadow.
- **Chips/Status:** Use the Success Mossy-Green for "Trusted" devices and Warning Amber for "New Login" alerts. These should have a subtle background tint (10% opacity) and solid text.
- **Lists (Device Management):** Rows with 16px internal padding, separated by subtle hairlines. Primary info (Device Name) in Bold Charcoal; secondary info (Last seen) in muted gray.
- **Loading State:** The "Fox-paw" motif should be centered in the action area, using the primary color at 40% opacity for inactive pads and 100% for the active "step."
