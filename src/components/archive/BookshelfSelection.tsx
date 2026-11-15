import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useT, type Lang } from "../../i18n";
import type { RenCollectionItem } from "../../lib/ren-collection";

interface Props { items: RenCollectionItem[]; lang: Lang; }

function stableHeight(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) hash = (hash * 31 + id.charCodeAt(index)) | 0;
  return 150 + (Math.abs(hash) % 27);
}

function readableText(hex: string) {
  const normalized = /^#([0-9a-f]{6})$/i.exec(hex)?.[1];
  if (!normalized) return "rgba(255,255,255,.92)";
  const channels = [0, 2, 4].map((offset) => parseInt(normalized.slice(offset, offset + 2), 16) / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  const luminance = .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
  return luminance > .48 ? "#17171b" : "rgba(255,255,255,.92)";
}

export default function BookshelfSelection({ items, lang }: Props) {
  const t = useT(lang);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(() => items.find((item) => item.animeId === selectedId) ?? null, [items, selectedId]);
  const viewLabel = t("renCollection.view");

  return (
    <div className="bookshelf">
      <div className="bookshelf-grid">
        {items.map((item) => {
          const color = item.color || "#3a3a44";
          const textColor = readableText(color);
          const height = stableHeight(item.animeId);
          const active = selectedId === item.animeId;
          return (
            <button
              key={item.animeId}
              type="button"
              className={`book-spine${active ? " is-selected" : ""}`}
              style={{ "--spine-color": color, "--spine-text": textColor, "--spine-height": `${height}px` } as CSSProperties}
              aria-label={item.title}
              aria-pressed={active}
              onClick={() => setSelectedId(item.animeId)}
              onPointerEnter={(event) => { if (event.pointerType === "mouse") setSelectedId(item.animeId); }}
              onFocus={() => setSelectedId(item.animeId)}
            >
              <span>{item.title}</span>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="book-preview" aria-live="polite">
          {selected.cover && <img key={selected.animeId} src={selected.cover} alt="" width="230" height="345" loading="eager" fetchPriority="high" decoding="async" />}
          <div className="book-preview-copy">
            <h3>{selected.title}</h3>
            <a href={selected.href}>{viewLabel}</a>
          </div>
        </div>
      )}

      <style>{`
        .bookshelf { width: 100%; }
        .bookshelf-grid { display: grid; grid-template-columns: repeat(11, minmax(0, 1fr)); align-items: end; gap: 18px 5px; }
        .book-spine { position: relative; display: flex; align-items: flex-start; justify-content: center; width: 100%; height: var(--spine-height); min-width: 0; padding: 12px 3px 10px; overflow: visible; border: 0; border-radius: 2px 2px 0 0; background: var(--spine-color, #3a3a44); color: var(--spine-text, rgba(255,255,255,.92)); cursor: pointer; box-shadow: 0 7px 0 #1a1a1f, 0 8px 0 rgba(255,255,255,.12), 0 13px 15px rgba(0,0,0,.2); transform: translateY(0); transition: transform 180ms ease, outline-color 180ms ease; }
        .book-spine span { display: -webkit-box; overflow: hidden; max-height: calc(var(--spine-height) - 22px); font: 700 10.5px/1.15 var(--font-body); writing-mode: vertical-rl; text-overflow: ellipsis; white-space: normal; }
        .book-spine:hover, .book-spine.is-selected { z-index: 1; transform: translateY(-16px); }
        .book-spine.is-selected { outline: 2px solid #ec4899; outline-offset: 0; }
        .book-spine:focus-visible { outline: 2px solid #f472b6; outline-offset: 2px; }
        .book-preview { display: grid; grid-template-columns: minmax(6rem, 9rem) minmax(0, 1fr); align-items: center; gap: 1rem; margin-top: 1.5rem; }
        .book-preview img { display: block; width: 100%; max-height: 13rem; aspect-ratio: 2/3; object-fit: cover; border-radius: 4px; }
        .book-preview-copy h3 { margin: 0 0 .75rem; color: var(--color-paper-50); font: 600 1.1rem/1.2 var(--font-body); }
        .book-preview-copy a { display: inline-flex; padding: .65rem 1rem; border-radius: 999px; background: #ec4899; color: #fff; font-size: .8rem; font-weight: 650; }
        @media (min-width: 700px) { .bookshelf-grid { grid-template-columns: repeat(14, minmax(0, 1fr)); } }
        @media (min-width: 1100px) { .bookshelf-grid { grid-template-columns: repeat(18, minmax(0, 1fr)); } }
        @media (prefers-reduced-motion: reduce) { .book-spine, .book-spine:hover, .book-spine.is-selected { transition: none; transform: none; } }
      `}</style>
    </div>
  );
}
