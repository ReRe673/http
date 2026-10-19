import { useEffect, useState } from 'react';

const glyphs = 'アイウエオカキクケコ0123456789<>/[]{}';

export function DecoderText({ text, delay = 0, duration = 850, className = '' }) {
  const [value, setValue] = useState(text);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(text);
      return undefined;
    }

    let frame = 0;
    const startedAt = performance.now() + delay;
    const render = now => {
      const progress = Math.max(0, Math.min(1, (now - startedAt) / duration));
      const revealed = Math.floor(progress * text.length);
      const next = [...text].map((character, index) => {
        if (/\s/.test(character) || index < revealed) return character;
        return glyphs[Math.floor(Math.random() * glyphs.length)];
      }).join('');
      setValue(next);
      if (progress < 1) frame = requestAnimationFrame(render);
      else setValue(text);
    };
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, [delay, duration, text]);

  return <span className={className} aria-label={text}><span aria-hidden="true">{value}</span></span>;
}
