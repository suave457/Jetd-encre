import { PUBLIC_BLOG_ARTICLES } from './publicContentArticles.js';
import { publicationId } from './features/editorial/publicationCore.js';

export function isDemoArticlePreview(search = '') {
  const modes = new URLSearchParams(search).getAll('mode');
  return modes.length === 1 && modes[0] === 'demo';
}

export function articlePath(slug, demoPreview = false) {
  return '/blog/' + encodeURIComponent(slug) + (demoPreview ? '?mode=demo' : '');
}

// Public pages always use the versioned editorial catalogue. Local edits are
// opt-in previews; they never publish, delete or overwrite the public catalogue.
export function resolvePublicArticles(articles = [], { demoPreview = false } = {}) {
  if (!demoPreview) return PUBLIC_BLOG_ARTICLES;
  const storedSlugs = new Set(articles.map(item => item.slug));
  const untouched = PUBLIC_BLOG_ARTICLES.filter(item => !storedSlugs.has(item.slug));
  const published = articles.filter(item => item.status === 'Publié').map((item, index) => {
    const source = PUBLIC_BLOG_ARTICLES.find(article => article.slug === item.slug);
    const paragraphs = String(item.body || item.excerpt || '').split(/\n+/).map(value => value.trim()).filter(Boolean);
    return {
      ...(source || {}),
      slug: item.slug,
      category: item.category || source?.category || 'Parents',
      theme: item.theme || source?.theme || 'Pédagogie',
      audience: item.category || source?.audience || 'Communauté éducative',
      date: new Date(item.publishedAt || item.updatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
      readTime: item.readTime || source?.readTime || '6 min',
      author: item.author || source?.author || 'L’équipe Jet d’Encre',
      featured: source?.featured || index === 0,
      title: item.title,
      excerpt: item.excerpt || source?.excerpt || 'Une ressource éditoriale Jet d’Encre pour accompagner les apprentissages.',
      image: source?.image || '/assets/generated-1774018887348.png',
      imageAlt: source?.imageAlt || 'Illustration éditoriale Jet d’Encre',
      takeaway: source?.takeaway || item.excerpt || 'Une idée concrète à mettre en pratique progressivement.',
      sections: item.body?.trim() ? paragraphs.map((copy, part) => [`Partie ${part + 1}`, copy]) : source?.sections || [['À retenir', item.excerpt || 'Cet article sera enrichi par l’équipe éditoriale.']],
    };
  });
  return [...published, ...untouched];
}

export function publicArticleShareData(slug, origin, confirmedArticle) {
  const article = PUBLIC_BLOG_ARTICLES.find(item => item.slug === slug) || (publicationId(slug) && confirmedArticle?.source === 'publication' && confirmedArticle.slug === slug ? confirmedArticle : null);
  if (!article) return null;
  try {
    const base = new URL(origin);
    if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) return null;
    // Never share the current URL: it may contain preview or account parameters.
    return { title: article.title, url: new URL(articlePath(slug), base.origin).href };
  } catch { return null; }
}

export async function sharePublicArticle(data, browser = globalThis.navigator) {
  if (!data) return 'unavailable';
  if (typeof browser?.share === 'function') {
    try { await browser.share(data); return 'shared'; }
    catch (error) { if (error?.name === 'AbortError') return 'cancelled'; }
  }
  try {
    if (typeof browser?.clipboard?.writeText === 'function') {
      await browser.clipboard.writeText(data.url);
      return 'copied';
    }
  } catch { /* A denied clipboard requires an explicit manual fallback. */ }
  return 'manual';
}
