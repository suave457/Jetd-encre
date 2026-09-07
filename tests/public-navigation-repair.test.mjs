import assert from 'node:assert/strict';
import test from 'node:test';
import { PUBLIC_BLOG_ARTICLES } from '../src/publicContentArticles.js';
import { isDemoArticlePreview, articlePath, resolvePublicArticles, publicArticleShareData, sharePublicArticle } from '../src/publicArticleCore.js';
import { publicContactHref } from '../src/publicContactCore.js';

test('public article catalogue ignores local publication, edits and archives by default', () => {
  const original = PUBLIC_BLOG_ARTICLES[0];
  const local = [{ ...original, title: 'Titre local', status: 'Archivé' }, { slug: 'nouveau-local', title: 'Article local', body: 'Texte local', status: 'Publié', updatedAt: '2026-09-06' }];
  const before = structuredClone(local);
  assert.strictEqual(resolvePublicArticles(local), PUBLIC_BLOG_ARTICLES);
  assert.deepEqual(local, before);
  assert.equal(resolvePublicArticles(local).find(item => item.slug === original.slug).title, original.title);
  assert.equal(resolvePublicArticles(local).some(item => item.slug === 'nouveau-local'), false);
});

test('explicit local preview preserves local edits without altering the public catalogue', () => {
  const original = PUBLIC_BLOG_ARTICLES[0];
  const local = [{ ...original, status: 'Archivé' }, { slug: 'nouveau-local', title: 'Article local', body: 'Premier paragraphe.\nDeuxième paragraphe.', status: 'Publié', updatedAt: '2026-09-06' }];
  const preview = resolvePublicArticles(local, { demoPreview: true });
  assert.equal(preview.some(item => item.slug === original.slug), false);
  assert.equal(preview.find(item => item.slug === 'nouveau-local').sections.length, 2);
  assert.equal(PUBLIC_BLOG_ARTICLES.some(item => item.slug === original.slug), true);
  assert.equal(new Set(preview.map(item => item.slug)).size, preview.length);
});

test('preview mode is explicit, unambiguous and preserved by article links', () => {
  assert.equal(isDemoArticlePreview('?mode=demo'), true);
  for (const search of ['', '?mode=', '?mode=school', '?mode=demo&mode=demo', '?mode=demo&mode=public']) assert.equal(isDemoArticlePreview(search), false);
  assert.equal(articlePath('article'), '/blog/article');
  assert.equal(articlePath('article', true), '/blog/article?mode=demo');
});

test('sharing uses the public article title and a clean URL, not a local or account URL', () => {
  const original = PUBLIC_BLOG_ARTICLES[0];
  assert.deepEqual(publicArticleShareData(original.slug, 'https://example.org/pilote?profil=parent#test'), { title: original.title, url: 'https://example.org/blog/' + original.slug });
  assert.equal(publicArticleShareData('local-only', 'https://example.org'), null);
  for (const origin of ['', 'javascript:alert(1)', 'https://name:password@example.org']) assert.equal(publicArticleShareData(original.slug, origin), null);
});

test('share success is reported only after the native share resolves', async () => {
  let delivered;
  const data = { title: 'Article', url: 'https://example.org/blog/article' };
  assert.equal(await sharePublicArticle(data, { share: async value => { delivered = value; } }), 'shared');
  assert.deepEqual(delivered, data);
});

test('cancelled native share does not unexpectedly copy the link', async () => {
  let copied = false;
  assert.equal(await sharePublicArticle({ url: 'https://example.org' }, { share: async () => { throw Object.assign(new Error('cancel'), { name: 'AbortError' }); }, clipboard: { writeText: async () => { copied = true; } } }), 'cancelled');
  assert.equal(copied, false);
});

test('unsupported or refused native share falls back to clipboard, then manual copy', async () => {
  const data = { url: 'https://example.org/blog/article' };
  let copied;
  assert.equal(await sharePublicArticle(data, { clipboard: { writeText: async value => { copied = value; } } }), 'copied');
  assert.equal(copied, data.url);
  assert.equal(await sharePublicArticle(data, { share: async () => { throw new Error('denied'); }, clipboard: { writeText: async () => { throw new Error('denied'); } } }), 'manual');
  assert.equal(await sharePublicArticle(data, {}), 'manual');
  assert.equal(await sharePublicArticle(null, {}), 'unavailable');
});

test('placeholder contacts are never clickable and no mail headers can be injected', () => {
  for (const address of ['', 'assistance@jetdencre.invalid', 'CONTACT@EXAMPLE.INVALID', 'a@sub.example.invalid', 'invalid', 'a@example.org?subject=secret', 'a@example.org\r\nBcc:other@example.org']) assert.equal(publicContactHref(address), null, address);
  assert.equal(publicContactHref(' support@example.org '), 'mailto:support@example.org');
});
