import { useEffect, useState, type CSSProperties } from "react";
import "@fontsource/anton";
import { percents, type DuelSide } from "./duel";
import "./WeeklyDuel.css";

export type DuelState = {
  week: string;
  a: DuelSide;
  b: DuelSide;
  myVote: "a" | "b" | null;
  counts: { a: number; b: number } | null;
};

type Props = {
  initial: DuelState;
  loggedIn: boolean;
  loginHref: string;
  voteUrl: string;
  t: {
    title: string;
    subtitle: string;
    voted: string;
    votes: (n: number) => string;
    locale: "es" | "en";
    next: string;
    voteFor: (name: string) => string;
    error: string;
  };
};

function useCountUp(to: number, active: boolean, delay = 100, duration = 900) {
  const [value, setValue] = useState(active ? 0 : 0);

  useEffect(() => {
    if (!active) {
      setValue(0);
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(to);
      return;
    }

    let frame = 0;
    let startedAt = 0;
    const tick = (now: number) => {
      if (!startedAt) startedAt = now;
      const elapsed = now - startedAt - delay;
      const progress = Math.min(1, Math.max(0, elapsed / duration));
      setValue(Math.round(to * (1 - Math.pow(1 - progress, 3))));
      if (elapsed < duration) frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [to, active, delay, duration]);

  return value;
}

function Percentage({ value, active, locale }: { value: number; active: boolean; locale: "es" | "en" }) {
  const count = useCountUp(value, active);
  return <span className="dd-pct" aria-hidden="true">{count.toLocaleString(locale)}%</span>;
}

export default function WeeklyDuel({ initial, loggedIn, loginHref, voteUrl, t }: Props) {
  const [s, setS] = useState(initial);
  const [pending, setPending] = useState<"a" | "b" | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const [go, setGo] = useState(false);

  const done = s.myVote !== null && s.counts !== null;
  const [pa, pb] = done ? percents(s.counts!.a, s.counts!.b) : [0, 0];
  const total = done ? s.counts!.a + s.counts!.b : 0;
  const picked = s.myVote ?? pending;

  useEffect(() => {
    if (!done) {
      setGo(false);
      return;
    }
    let second = 0;
    const frame = window.requestAnimationFrame(() => {
      second = window.requestAnimationFrame(() => setGo(true));
    });
    return () => {
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(second);
    };
  }, [done]);

  async function vote(choice: "a" | "b") {
    if (!loggedIn) {
      window.location.href = loginHref;
      return;
    }
    if (done || busy) return;

    setBusy(true);
    setErr(false);
    setPending(choice);

    try {
      const response = await fetch(voteUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week: s.week, choice }),
      });
      if (!response.ok) throw new Error(String(response.status));

      const data = (await response.json()) as {
        choice: "a" | "b";
        counts: { a: number; b: number };
      };
      setS((previous) => ({ ...previous, myVote: data.choice, counts: data.counts }));
      setPending(data.choice);
    } catch {
      setErr(true);
      setPending(null);
    } finally {
      setBusy(false);
    }
  }

  const side = (key: "a" | "b", anime: DuelSide, percentage: number) => {
    const isWinner = picked === key;
    const isLoser = done && s.myVote !== key;
    const style = { "--p": percentage } as CSSProperties;

    return (
      <button
        type="button"
        key={key}
        className="dd-side"
        data-win={isWinner}
        data-lose={isLoser}
        aria-label={t.voteFor(anime.title)}
        aria-pressed={s.myVote === key}
        disabled={done || busy}
        onClick={() => vote(key)}
      >
        <span className="dd-ph" style={{ background: anime.color ?? "#1c1c22" }}>
          <img src={anime.image} alt="" width={165} height={247} loading="lazy" draggable={false} />
          {done && (
            <>
              <span className="dd-veil" style={style} />
              <Percentage value={percentage} active={go} locale={t.locale} />
            </>
          )}
        </span>
        <b>{anime.title}</b>
      </button>
    );
  };

  return (
    <section className="dd" data-done={done} data-go={go} aria-label={t.title}>
      <h2>{t.title}</h2>
      <p className="dd-sub">{done ? t.voted : t.subtitle}</p>
      <div className="dd-row">
        {side("a", s.a, pa)}
        <span className="dd-vs" aria-hidden="true">VS</span>
        {side("b", s.b, pb)}
      </div>
      {done && <p className="dd-meta">{t.votes(total)} · {t.next}</p>}
      {err && <p className="dd-err" role="alert">{t.error}</p>}
      <span className="dd-sr" aria-live="polite">
        {done ? t.voted : ""}
      </span>
    </section>
  );
}
