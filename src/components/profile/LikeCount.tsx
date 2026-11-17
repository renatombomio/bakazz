type Props = {
  count: number;
  liked: boolean;                          // ¿quien mira el perfil también le dio me gusta? (en su propio perfil, sus propios me gusta)
  lang: string;                            // "es" | "en" para formatear (1,2 mil / 1.2K)
  label: (n: number, liked: boolean) => string;   // i18n: "12 me gusta" / "12 me gusta, a ti también"
  variant?: "pill" | "inline";             // pill: sobre un póster · inline: bajo el nombre de un personaje
};

const fmt = (n: number, lang: string) => new Intl.NumberFormat(lang, { notation: "compact", maximumFractionDigits: 1 }).format(n);

export default function LikeCount({ count, liked, lang, label, variant = "pill" }: Props) {
  return (
    <span className={variant === "pill" ? "lk" : "lc"} data-liked={liked} role="img" aria-label={label(count, liked)}>
      <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" focusable="false">
        <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"
          fill={liked ? "#ec4899" : "none"} stroke={liked ? "#ec4899" : "currentColor"} strokeWidth="2" strokeLinejoin="round" />
      </svg>
      {fmt(count, lang)}
    </span>
  );
}