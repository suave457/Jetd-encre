// Shared, unchanged presentation from the validated Jet d’Encre screens.
export default function PageHeader({eyebrow,title,subtitle,action,serif=false}){return <div className="page-header"><div><span className="page-eyebrow">{eyebrow}</span><h1 className={serif?"serif":""}>{title}</h1>{subtitle&&<p>{subtitle}</p>}</div>{action}</div>}
