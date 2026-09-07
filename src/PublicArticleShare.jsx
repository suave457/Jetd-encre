import { useEffect, useRef, useState } from 'react';
import { PaperPlaneTilt } from '@phosphor-icons/react/ssr';
import { publicArticleShareData, sharePublicArticle } from './publicArticleCore.js';

export default function PublicArticleShare({ slug, article, demoPreview = false }) {
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);
  const field = useRef(null);
  const generation = useRef(0);
  const inFlight = useRef(false);
  const data = publicArticleShareData(slug, typeof window === 'undefined' ? '' : window.location.origin, demoPreview ? null : article);
  useEffect(() => { ++generation.current; setResult(''); setBusy(false); inFlight.current = false; return () => { ++generation.current; }; }, [slug, demoPreview]);
  useEffect(() => { if (result === 'manual') { field.current?.focus(); field.current?.select(); } }, [result]);
  async function share() {
    if (inFlight.current) return;
    const version = generation.current;
    inFlight.current = true; setBusy(true); setResult('');
    try {
      const next = await sharePublicArticle(data);
      if (version === generation.current) setResult(next);
    } finally {
      if (version === generation.current) { inFlight.current = false; setBusy(false); }
    }
  }
  const messages = {
    shared: 'Partage effectué avec l’outil de ton appareil.',
    copied: 'Le lien de l’article a été copié.',
    cancelled: 'Partage annulé : aucun lien n’a été copié.',
    manual: 'La copie automatique est indisponible. Copie le lien sélectionné ci-dessous.',
    unavailable: 'Cet article existe seulement dans l’aperçu local. Il n’a pas de lien public à partager.',
  };
  return <div className="article-share"><div><strong>Cet article vous a été utile ?</strong><span>{demoPreview ? 'Le partage concerne uniquement la version du site, sans les modifications locales.' : 'Partagez l’idée avec votre équipe ou votre famille.'}</span>{result && <p role="status">{messages[result]}</p>}{result === 'manual' && data && <label>Lien de l’article<input ref={field} readOnly value={data.url} onFocus={event => event.currentTarget.select()} /></label>}</div><button className="button button-light" type="button" onClick={share} disabled={busy}><PaperPlaneTilt/> {busy ? 'Partage…' : 'Partager'}</button></div>;
}
