// One-shot generator: fills the blurb field of every template with a short,
// prompt-style line for cards and detail pages. Safe to re-run (idempotent
// by slug hash, overwrites existing blurbs).
import { readFileSync, writeFileSync } from "fs";
import path from "path";

type Template = {
  slug: string;
  name: string;
  photo_count: number;
  duration_sec: number;
  tags: string[];
  category: string | null;
  blurb: string | null;
};

function hash(input: string): number {
  let value = 0;
  for (let index = 0; index < input.length; index += 1) {
    value = (value * 31 + input.charCodeAt(index)) >>> 0;
  }
  return value;
}

function photos(count: number): string {
  return count === 1 ? "one photo" : `${count} photos`;
}

function build(template: Template): string {
  const { name, slug } = template;
  const shots = photos(template.photo_count);
  const seconds = `${template.duration_sec}s`;

  const generic = [
    `You, inside “${name}”. Drop ${shots}, get the ${seconds} clip.`,
    `Recreate “${name}” — same energy, ${shots}, ${seconds}.`,
    `“${name}”, but it's you. ${shots} in, one ${seconds} render out.`,
    `Your take on “${name}”. Feed it ${shots}, press render.`,
    `The “${name}” effect with your face in the lead. ${seconds}, ${shots}.`,
  ];
  const pet = [
    `Your pet stars in “${name}”. ${shots}, ${seconds} of chaos.`,
    `Put your pet inside “${name}” — ${shots}, ${seconds}, pure viral.`,
  ];
  const music = [
    `You perform “${name}” beat for beat. ${shots}, ${seconds}.`,
    `Lip-sync “${name}” like the original. ${shots}, ${seconds}.`,
  ];

  const pool = template.tags.includes("pet")
    ? pet
    : template.category === "music" || template.tags.includes("music") || template.tags.includes("dance")
      ? music
      : generic;
  return pool[hash(slug) % pool.length];
}

const file = path.join(process.cwd(), "data", "templates.json");
const data = JSON.parse(readFileSync(file, "utf8")) as { templates: Template[] };
let filled = 0;
for (const template of data.templates) {
  const next = build(template);
  if (template.blurb !== next) filled += 1;
  template.blurb = next;
}
writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
console.log(`blurbs written: ${filled}/${data.templates.length}`);
