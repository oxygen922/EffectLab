"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const SUGGESTIONS = [
  "make my cat dance",
  "gym motivation edit",
  "turn me into a rap star",
  "pet transformations",
  "halloween look",
];

/** CreatOK-style prompt bar: describe the clip, land on the catalog with the query applied. */
export function PromptBar() {
  const router = useRouter();
  const [value, setValue] = useState("");

  function go(text: string) {
    const q = text.trim();
    router.push(q ? `/templates?q=${encodeURIComponent(q)}` : "/templates");
  }

  return (
    <div className="prompt-band">
      <form
        className="prompt-bar"
        onSubmit={(event) => {
          event.preventDefault();
          go(value);
        }}
      >
        <span className="prompt-glyph" aria-hidden>
          ✦
        </span>
        <input
          aria-label="Describe the video you want"
          placeholder="Describe the video you want — try “my cat doing a victory dance”"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <button className="btn primary" type="submit">
          Generate
        </button>
      </form>
      <div className="chip-row prompt-chips">
        {SUGGESTIONS.map((item) => (
          <button key={item} type="button" className="chip" onClick={() => go(item)}>
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}
