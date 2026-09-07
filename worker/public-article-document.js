import {readPublicArticle} from './public-articles.js';
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export async function publicArticleDocument(request,env,slug){
  const headers={'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'};
  if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{...headers,Allow:'GET, HEAD'}});
  let article,status=200;
  try{if(!env.DB)throw new Error('Database unavailable');article=await readPublicArticle(env.DB,slug);}catch(error){status=error instanceof Response?error.status:503;}
  try{
    const page=await env.ASSETS.fetch(new Request(new URL('/index.html',request.url),{method:'GET',headers:{Accept:'text/html'}}));
    if(!page.ok)throw new Error('Application unavailable');
    let html=await page.text();
    // Only remove the build-owned root, never an arbitrary nested div.
    html=html.replace(/<div id="root" data-prerendered="true">[\s\S]*?<\/div><!--jde-prerender-end-->/,'<div id="root"></div>');
    if(!html.includes('<div id="root"></div>'))throw new Error('Unknown application template');
    const title=article?article.title+' — Jet d’Encre':status===404?'Article indisponible — Jet d’Encre':'Mag indisponible — Jet d’Encre';
    const description=article?.excerpt||'Retrouvez les articles disponibles dans le Mag Jet d’Encre.';
    html=html.replace(/<title>[\s\S]*?<\/title>/,()=>'<title>'+escape(title)+'</title>');
    for(const key of ['description','og:description','twitter:description','og:title','twitter:title','robots']){
      const value=key==='robots'?'noindex, nofollow':key.endsWith('title')?title:description;
      html=html.replace(new RegExp('(<meta (?:property|name)="'+key+'" content=")[^"]*(")'),(_,before,after)=>before+escape(value)+after);
    }
    html=html.replace(/<link rel="canonical"[^>]*>/g,'').replace(/<meta property="og:url"[^>]*>/g,'');
    html=html.replace(/<meta (?:property|name)="(?:og:type|og:image(?::(?:width|height|alt))?|twitter:image(?::alt)?|article:published_time)"[^>]*>/g,'');
    if(article){const imageUrl=new URL(article.image,request.url).href;html=html.replace('</head>',()=>'<meta property="og:type" content="article"><meta property="og:image" content="'+escape(imageUrl)+'"><meta property="og:image:alt" content="'+escape(article.imageAlt)+'"><meta name="twitter:image" content="'+escape(imageUrl)+'"><meta name="twitter:image:alt" content="'+escape(article.imageAlt)+'"><meta property="article:published_time" content="'+escape(article.publishedAt)+'"></head>');}
    return new Response(request.method==='HEAD'?null:html,{status,headers});
  }catch{
    return new Response(request.method==='HEAD'?null:'<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mag indisponible</title><main><h1>Le Mag est momentanément indisponible</h1><p>Veuillez réessayer dans quelques instants.</p><a href="/blog">Retour au Mag</a></main></html>',{status:503,headers});
  }
}
