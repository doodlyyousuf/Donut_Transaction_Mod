/**
 * Material 3 dynamic color.
 *
 * A seed color is expanded into tonal palettes (hue + chroma held constant
 * across perceptual lightness "tone", where tone === CIELAB L*). Roles such as
 * `primary` / `surface-container-high` are then read off specific tones for the
 * requested light or dark scheme, matching the Material 3 spec.
 *
 * CIELAB is used as the tone space because L* is perceptually uniform, which is
 * what keeps contrast predictable across every generated theme.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export type ColorRole =
  | "primary" | "on-primary" | "primary-container" | "on-primary-container"
  | "secondary" | "on-secondary" | "secondary-container" | "on-secondary-container"
  | "tertiary" | "on-tertiary" | "tertiary-container" | "on-tertiary-container"
  | "error" | "on-error" | "error-container" | "on-error-container"
  | "surface" | "on-surface" | "surface-variant" | "on-surface-variant"
  | "surface-dim" | "surface-bright"
  | "surface-container-lowest" | "surface-container-low" | "surface-container"
  | "surface-container-high" | "surface-container-highest"
  | "outline" | "outline-variant"
  | "inverse-surface" | "inverse-on-surface" | "inverse-primary"
  | "scrim" | "shadow";

export type ColorScheme = Record<ColorRole, string>;

export type SchemeVariant =
  | "tonal" | "vibrant" | "expressive" | "neutral" | "monochrome";

export type ThemeMode = "light" | "dark" | "system";

// ---------------------------------------------------------------- conversions

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

function srgbToLinear(c: number): number {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearToSrgb(c: number): number {
  const v = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return clamp(v) * 255;
}

/** sRGB (0-255) -> CIELAB. */
export function rgbToLab({ r, g, b }: Rgb): [number, number, number] {
  const lr = srgbToLinear(r), lg = srgbToLinear(g), lb = srgbToLinear(b);

  const x = 0.41239079926595934 * lr + 0.357584339383878 * lg + 0.1804807884018343 * lb;
  const y = 0.21263900587151027 * lr + 0.715168678767756 * lg + 0.07219231536073371 * lb;
  const z = 0.01933081871559182 * lr + 0.11919477979462598 * lg + 0.9505321522496607 * lb;

  const Xn = 0.9504559270516716, Yn = 1, Zn = 1.0890577507598784;
  const e = 216 / 24389, k = 24389 / 27;
  const f = (t: number) => (t > e ? Math.cbrt(t) : (k * t + 16) / 116);

  const fx = f(x / Xn), fy = f(y / Yn), fz = f(z / Zn);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** CIELAB -> linear sRGB (may be out of gamut). */
export function labToLinearRgb(L: number, a: number, b: number): [number, number, number] {
  const Xn = 0.9504559270516716, Yn = 1, Zn = 1.0890577507598784;
  const e = 216 / 24389, k = 24389 / 27;
  const fi = (t: number) => {
    const t3 = t * t * t;
    return t3 > e ? t3 : (116 * t - 16) / k;
  };

  const fy = (L + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;

  const x = Xn * fi(fx), y = Yn * fi(fy), z = Zn * fi(fz);

  return [
    3.2409699419045226 * x - 1.537383177570094 * y - 0.4986107602930034 * z,
    -0.9692436362808796 * x + 1.8759675015077202 * y + 0.04155505740717559 * z,
    0.05563007969699366 * x - 0.20397695888897652 * y + 1.0569715142428786 * z,
  ];
}

/** Is a Lab color representable in sRGB without clipping? */
function inGamut(L: number, C: number, H: number): boolean {
  const rad = (H * Math.PI) / 180;
  const [r, g, b] = labToLinearRgb(L, C * Math.cos(rad), C * Math.sin(rad));
  const eps = 1e-4;
  return r >= -eps && r <= 1 + eps && g >= -eps && g <= 1 + eps && b >= -eps && b <= 1 + eps;
}

/**
 * Largest chroma at (tone, hue) that stays in sRGB. This is what makes the
 * palette usable instead of relying on destructive per-channel clipping.
 */
function maxChroma(L: number, H: number, ceiling = 140): number {
  if (L <= 0 || L >= 100) return 0;

  let lo = 0, hi = ceiling;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(L, mid, H)) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** Lab + chroma + hue -> an sRGB color, reducing chroma only as much as needed. */
function lchToRgb(L: number, C: number, H: number): Rgb {
  const usable = Math.min(C, maxChroma(L, H));
  const rad = (H * Math.PI) / 180;
  const [r, g, b] = labToLinearRgb(L, usable * Math.cos(rad), usable * Math.sin(rad));
  return {
    r: Math.round(linearToSrgb(r)),
    g: Math.round(linearToSrgb(g)),
    b: Math.round(linearToSrgb(b)),
  };
}

// ------------------------------------------------------------------- palettes

export interface TonalPalette {
  hue: number;
  chroma: number;
  tone(t: number): Rgb;
}

function makePalette(hue: number, chroma: number): TonalPalette {
  return {
    hue,
    chroma,
    tone: (t: number) => lchToRgb(t, chroma, ((hue % 360) + 360) % 360),
  };
}

/** Chroma scale per scheme variant, as [primary, secondary, tertiary]. */
const VARIANT_CHROMA: Record<SchemeVariant, [number, number, number]> = {
  tonal: [36, 16, 24],
  vibrant: [62, 44, 54],
  expressive: [48, 24, 40],
  neutral: [12, 8, 12],
  monochrome: [0, 0, 0],
};

export function hexToRgb(hex: string): Rgb {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return { r: 0, g: 0, b: 0 };
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

/** Relative luminance, used to pick readable text over an arbitrary color. */
export function relativeLuminance({ r, g, b }: Rgb): number {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a), lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export interface Palettes {
  primary: TonalPalette;
  secondary: TonalPalette;
  tertiary: TonalPalette;
  neutral: TonalPalette;
  neutralVariant: TonalPalette;
  error: TonalPalette;
}

/**
 * Lab-hue ranges that render as pink / magenta / rose. In CIELAB the +a axis is
 * magenta-red, so hues just past 0 and just before 360 both read pink, and the
 * 300-360 arc is magenta. The tertiary accent avoids all of them so no seed can
 * accidentally produce a "girlie" accent from the naive Material +60 rotation.
 */
const FORBIDDEN_TERTIARY_BANDS: readonly (readonly [number, number])[] = [
  [300, 360],
  [0, 35],
];

function wrapHue(h: number): number {
  return ((h % 360) + 360) % 360;
}

function inForbiddenBand(h: number): boolean {
  return FORBIDDEN_TERTIARY_BANDS.some(([lo, hi]) => h >= lo && h <= hi);
}

/** Pick a distinct, non-pink tertiary hue nearest to the Material +60 rotation. */
function tertiaryHue(hue: number, variant: SchemeVariant): number {
  const offsets = variant === "expressive"
    ? [120, -60, 60, -120, 180]
    : [60, -60, 120, -120, 180];
  for (const offset of offsets) {
    const candidate = wrapHue(hue + offset);
    if (!inForbiddenBand(candidate)) return candidate;
  }
  return wrapHue(hue + 180);
}

export function buildPalettes(seedHex: string, variant: SchemeVariant): Palettes {
  const [, a, b] = rgbToLab(hexToRgb(seedHex));
  const hue = wrapHue((Math.atan2(b, a) * 180) / Math.PI);
  const [cPrimary, cSecondary, cTertiary] = VARIANT_CHROMA[variant];

  // Tertiary is a nearby-but-distinct accent; the guard above keeps it out of
  // the pink band so every generated theme stays in a professional register.
  const tertiaryHueValue = tertiaryHue(hue, variant);

  // Neutral families keep a hint of the seed hue so surfaces feel related to
  // the brand rather than dead gray (except in monochrome, where they are pure).
  const neutralChroma = variant === "monochrome" ? 0 : 4;
  const variantChroma = variant === "monochrome" ? 0 : 8;

  return {
    primary: makePalette(hue, cPrimary),
    secondary: makePalette(hue, cSecondary),
    tertiary: makePalette(tertiaryHueValue, cTertiary),
    neutral: makePalette(hue, neutralChroma),
    neutralVariant: makePalette(hue, variantChroma),
    error: makePalette(25, 84),
  };
}

// --------------------------------------------------------------------- scheme

const fmt = ({ r, g, b }: Rgb) => `${r} ${g} ${b}`;

export function buildScheme(seedHex: string, variant: SchemeVariant, dark: boolean): ColorScheme {
  const p = buildPalettes(seedHex, variant);
  const { primary, secondary, tertiary, neutral, neutralVariant, error } = p;

  if (dark) {
    return {
      primary: fmt(primary.tone(80)),
      "on-primary": fmt(primary.tone(20)),
      "primary-container": fmt(primary.tone(30)),
      "on-primary-container": fmt(primary.tone(90)),

      secondary: fmt(secondary.tone(80)),
      "on-secondary": fmt(secondary.tone(20)),
      "secondary-container": fmt(secondary.tone(30)),
      "on-secondary-container": fmt(secondary.tone(90)),

      tertiary: fmt(tertiary.tone(80)),
      "on-tertiary": fmt(tertiary.tone(20)),
      "tertiary-container": fmt(tertiary.tone(30)),
      "on-tertiary-container": fmt(tertiary.tone(90)),

      error: fmt(error.tone(80)),
      "on-error": fmt(error.tone(20)),
      "error-container": fmt(error.tone(30)),
      "on-error-container": fmt(error.tone(90)),

      surface: fmt(neutral.tone(6)),
      "on-surface": fmt(neutral.tone(90)),
      "surface-variant": fmt(neutralVariant.tone(30)),
      "on-surface-variant": fmt(neutralVariant.tone(80)),

      "surface-dim": fmt(neutral.tone(6)),
      "surface-bright": fmt(neutral.tone(24)),
      "surface-container-lowest": fmt(neutral.tone(4)),
      "surface-container-low": fmt(neutral.tone(10)),
      "surface-container": fmt(neutral.tone(12)),
      "surface-container-high": fmt(neutral.tone(17)),
      "surface-container-highest": fmt(neutral.tone(22)),

      outline: fmt(neutralVariant.tone(60)),
      "outline-variant": fmt(neutralVariant.tone(30)),

      "inverse-surface": fmt(neutral.tone(90)),
      "inverse-on-surface": fmt(neutral.tone(20)),
      "inverse-primary": fmt(primary.tone(40)),
      scrim: fmt(neutral.tone(0)),
      shadow: "0 0 0",
    };
  }

  return {
    primary: fmt(primary.tone(40)),
    "on-primary": fmt(primary.tone(100)),
    "primary-container": fmt(primary.tone(90)),
    "on-primary-container": fmt(primary.tone(10)),

    secondary: fmt(secondary.tone(40)),
    "on-secondary": fmt(secondary.tone(100)),
    "secondary-container": fmt(secondary.tone(90)),
    "on-secondary-container": fmt(secondary.tone(10)),

    tertiary: fmt(tertiary.tone(40)),
    "on-tertiary": fmt(tertiary.tone(100)),
    "tertiary-container": fmt(tertiary.tone(90)),
    "on-tertiary-container": fmt(tertiary.tone(10)),

    error: fmt(error.tone(40)),
    "on-error": fmt(error.tone(100)),
    "error-container": fmt(error.tone(90)),
    "on-error-container": fmt(error.tone(10)),

    surface: fmt(neutral.tone(98)),
    "on-surface": fmt(neutral.tone(10)),
    "surface-variant": fmt(neutralVariant.tone(90)),
    "on-surface-variant": fmt(neutralVariant.tone(30)),

    "surface-dim": fmt(neutral.tone(87)),
    "surface-bright": fmt(neutral.tone(98)),
    "surface-container-lowest": fmt(neutral.tone(100)),
    "surface-container-low": fmt(neutral.tone(96)),
    "surface-container": fmt(neutral.tone(94)),
    "surface-container-high": fmt(neutral.tone(92)),
    "surface-container-highest": fmt(neutral.tone(90)),

    outline: fmt(neutralVariant.tone(50)),
    "outline-variant": fmt(neutralVariant.tone(80)),

    "inverse-surface": fmt(neutral.tone(20)),
    "inverse-on-surface": fmt(neutral.tone(95)),
    "inverse-primary": fmt(primary.tone(80)),
    scrim: fmt(neutral.tone(0)),
    shadow: "0 0 0",
  };
}

const ROLE_CSS_ORDER: ColorRole[] = [
  "primary", "on-primary", "primary-container", "on-primary-container",
  "secondary", "on-secondary", "secondary-container", "on-secondary-container",
  "tertiary", "on-tertiary", "tertiary-container", "on-tertiary-container",
  "error", "on-error", "error-container", "on-error-container",
  "surface", "on-surface", "surface-variant", "on-surface-variant",
  "surface-dim", "surface-bright",
  "surface-container-lowest", "surface-container-low", "surface-container",
  "surface-container-high", "surface-container-highest",
  "outline", "outline-variant",
  "inverse-surface", "inverse-on-surface", "inverse-primary",
  "scrim", "shadow",
];

/** Apply a scheme to an element by writing CSS custom properties. */
export function applyScheme(scheme: ColorScheme, el: HTMLElement = document.documentElement): void {
  for (const role of ROLE_CSS_ORDER) {
    el.style.setProperty(`--md-${role}`, scheme[role]);
  }
}

/** Serialize a scheme so it can be replayed before first paint (no flash). */
export function serializeScheme(scheme: ColorScheme): string {
  return JSON.stringify(scheme);
}

export function parseScheme(raw: string | null): ColorScheme | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ColorScheme>;
    for (const role of ROLE_CSS_ORDER) {
      if (typeof parsed[role] !== "string") return null;
      if (!/^\d{1,3} \d{1,3} \d{1,3}$/.test(parsed[role] as string)) return null;
    }
    return parsed as ColorScheme;
  } catch {
    return null;
  }
}

export const schemeRoles = ROLE_CSS_ORDER;

/**
 * Resolve the seed to a color that is actually visible once mapped through the
 * tonal palettes; used for swatch previews in the theme picker.
 */
export function previewSwatch(seedHex: string, variant: SchemeVariant, dark: boolean): Rgb {
  const pal = buildPalettes(seedHex, variant);
  return pal.primary.tone(dark ? 80 : 40);
}
