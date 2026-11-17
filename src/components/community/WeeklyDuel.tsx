import { useState } from "react";
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
    votesSuffix: string;
    locale: "es" | "en";
    voteForPrefix: string;
    next: string;
    voteFor: (name: string) => string;
    error: string;
  };
};

export default function WeeklyDuel({ initial, loggedIn, loginHref, voteUrl, t }: Props) {
  const [s, setS] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const done = s.myVote !== null && s.counts !== null;
  const [pa, pb] = done ? percents(s.counts!.a, s.counts!.b) : [0, 0];
  const total = done ? s.counts!.a + s.counts!.b : 0;

  async function vote(choice: "a" | "b") {
    if (!loggedIn) { window.location.href = loginHref; return; }
    if (done || busy) return;
    setBusy(true);
    setErr(false);
    try {
      const res = await fetch(voteUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week: s.week, choice }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as {
        choice: "a" | "b";
        counts: { a: number; b: number };
      };
      setS((p) => ({ ...p, myVote: data.choice, counts: data.counts }));
    } catch {
      setErr(true);
    } finally {
      setBusy(false);
    }
  }

  const side = (k: "a" | "b", a: DuelSide, pct: number) => (
    <button
      type="button"
      key={k}
      className="dd-side"
      data-win={done && s.myVote === k}
      data-lose={done && s.myVote !== k}
      aria-label={t.voteForPrefix + a.title}
      aria-pressed={s.myVote === k}
      disabled={done || busy}
      onClick={() => vote(k)}
    >
      <span className="dd-ph" style={{ background: a.color ?? "#1c1c22" }}>
        <img src={a.image} alt="" width={165} height={247} loading="lazy" draggable={false} />
        {done && <span className="dd-pct">{pct}%</span>}
      </span>
      <b>{a.title}</b>
    </button>
  );

  return (
    <section className="dd" aria-label={t.title}>
      <h2>{t.title}</h2>
      <p className="dd-sub">{done ? t.voted : t.subtitle}</p>
      <div className="dd-row">
        {side("a", s.a, pa)}
        {!done && <span className="dd-vs" aria-hidden="true">VS</span>}
        {side("b", s.b, pb)}
      </div>
      {done && <p className="dd-meta">{total.toLocaleString(t.locale)} {t.votesSuffix} · {t.next}</p>}
      {err && <p className="dd-err" role="alert">{t.error}</p>}
    </section>
  );
}
