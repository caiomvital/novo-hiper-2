import { useEffect, useState } from 'react';

const QUERY = '(orientation: landscape) and (max-height: 500px)';

/** O modo de jogo cabe na altura disponível sem depender da API de tela cheia. */
export function useCompactLandscape(touch: boolean) {
  const [compact, setCompact] = useState(() => touch && window.matchMedia(QUERY).matches);
  useEffect(() => {
    const media = window.matchMedia(QUERY);
    const update = () => setCompact(touch && media.matches);
    media.addEventListener('change', update);
    update();
    return () => media.removeEventListener('change', update);
  }, [touch]);
  useEffect(() => {
    if (!compact) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [compact]);
  return compact;
}
