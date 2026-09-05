import { PUBLIC_PAGES, PUBLIC_TEST_NOTICE } from "./publicContent.js";
export function PublicInfoPage({ path, ui }) {
  const { RouteLink, PublicSubHeader, BlogFooter } = ui;
  const page = PUBLIC_PAGES[path];
  if (!page) return null;
  const secondary = page.secondaryCta || ["Comprendre la démarche", "/methode"];
  return <div className="blog-page public-info-page">
    <PublicSubHeader active={path}/>
    <main>
      <p className="prototype-banner" role="note"><strong>{PUBLIC_TEST_NOTICE.title}</strong> {PUBLIC_TEST_NOTICE.body}</p>
      <section className="section public-info-heading"><span className="eyebrow">{page.eyebrow}</span><h1>{page.title}</h1><p>{page.intro}</p></section>
      <div className="public-info-sections">{page.sections.map(([title, copy], i) =>
        <section key={title} className="panel"><span className="eyebrow">0{i + 1}</span><h2>{title}</h2><p>{copy}</p></section>
      )}</div>
      <div className="section public-info-actions"><RouteLink to={page.cta[1]} className="button button-gold">{page.cta[0]}</RouteLink><RouteLink to={secondary[1]} className="button button-light">{secondary[0]}</RouteLink></div>
    </main>
    <BlogFooter/>
  </div>;
}

