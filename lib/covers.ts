function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const PALETTES: Array<[string, string, string, string]> = [
  ["#1a1814", "#dff25a", "#ff5c33", "#f6f1e6"],
  ["#10211e", "#7ee0c6", "#f2c14e", "#f4efe4"],
  ["#241018", "#ff8fb3", "#f2e27a", "#fff6ea"],
  ["#14182a", "#9eb6ff", "#ff5c33", "#f4efe4"],
  ["#1c140c", "#e7a15a", "#f4efe4", "#8fd18a"],
  ["#101820", "#f25c54", "#f2d16b", "#efe7da"],
  ["#1b1424", "#d7b4ff", "#dff25a", "#f7f2ea"],
  ["#142018", "#b6f25a", "#f2f2f2", "#ffb085"],
];

function wrapTitle(title: string, width: number): string[] {
  const words = title.trim().split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > width && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 4);
}

/** Original geometric cover. Seeded by slug so each template is stable and unique. */
export function coverSvg(slug: string, title: string): string {
  const h = hash(slug);
  const palette = PALETTES[h % PALETTES.length];
  const [ink, acid, heat, paper] = palette;
  const shapes: string[] = [];
  for (let i = 0; i < 7; i += 1) {
    const x = (hash(`${slug}:x:${i}`) % 240) + 40;
    const y = (hash(`${slug}:y:${i}`) % 360) + 80;
    const r = (hash(`${slug}:r:${i}`) % 46) + 18;
    const fill = i % 2 === 0 ? acid : heat;
    shapes.push(
      `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" opacity="${0.35 + (i % 3) * 0.12}"/>`,
    );
  }
  const band = (hash(`${slug}:band`) % 140) + 160;
  const lines = wrapTitle(title, 16).map(escapeXml);
  const text = lines
    .map(
      (line, index) =>
        `<text x="36" y="${430 + index * 42}" fill="${paper}" font-family="Georgia, 'Iowan Old Style', serif" font-size="36">${line}</text>`,
    )
    .join("");
  const safeTitle = escapeXml(title);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 640" role="img" aria-label="${safeTitle} cover">
  <rect width="360" height="640" fill="${ink}"/>
  <g>${shapes.join("")}</g>
  <rect x="28" y="${band}" width="304" height="18" fill="${paper}" opacity="0.88" transform="rotate(-8 180 320)"/>
  <rect x="24" y="24" width="312" height="592" fill="none" stroke="${acid}" stroke-width="2" opacity="0.8"/>
  <text x="36" y="64" fill="${acid}" font-family="ui-sans-serif, sans-serif" font-size="16" letter-spacing="3">EFFECTLAB</text>
  <text x="36" y="92" fill="${paper}" font-family="ui-sans-serif, sans-serif" font-size="13" opacity="0.75">ORIGINAL COVER</text>
  ${text}
  <text x="36" y="590" fill="${heat}" font-family="ui-sans-serif, sans-serif" font-size="13" letter-spacing="1">${escapeXml(slug).slice(0, 32)}</text>
</svg>`;
}

export function resultSvg(input: {
  templateName: string;
  photoCount: number;
  durationSec: number;
}): string {
  const title = escapeXml(input.templateName);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 640" role="img" aria-label="EffectLab mock render of ${title}">
  <rect width="360" height="640" fill="#14120e"/>
  <circle cx="80" cy="180" r="36" fill="#dff25a">
    <animate attributeName="cx" values="70;280;70" dur="3.2s" repeatCount="indefinite"/>
    <animate attributeName="cy" values="160;420;160" dur="4.4s" repeatCount="indefinite"/>
  </circle>
  <rect x="40" y="240" width="90" height="90" fill="#ff5c33" opacity="0.9">
    <animateTransform attributeName="transform" type="rotate" values="0 85 285;12 85 285;0 85 285" dur="2.6s" repeatCount="indefinite"/>
  </rect>
  <circle cx="250" cy="460" r="48" fill="none" stroke="#7ee0c6" stroke-width="8">
    <animate attributeName="r" values="28;70;28" dur="3.8s" repeatCount="indefinite"/>
  </circle>
  <text x="28" y="78" fill="#dff25a" font-family="ui-sans-serif, sans-serif" font-size="14" letter-spacing="2">EFFECTLAB MOCK</text>
  <text x="28" y="130" fill="#f6f1e6" font-family="Georgia, serif" font-size="34">${title}</text>
  <text x="28" y="560" fill="#f6f1e6" font-family="ui-sans-serif, sans-serif" font-size="16">${input.photoCount} photo input · ${input.durationSec}s card</text>
  <text x="28" y="592" fill="#b3a898" font-family="ui-sans-serif, sans-serif" font-size="13">Original animation. Not a competitor sample.</text>
</svg>`;
}
