export default function DecisionKpi({ label, value, detail, definition, period, trend, tone = "green", freshness = "actualisé le 27 août 2026 à 11 h 45" }) {
  return <article className={`beta-decision-kpi tone-${tone}`}>
    <div><span>{label}</span><i>{trend}</i></div>
    <strong>{value}</strong>
    <p>{detail}</p>
    <details><summary>Définition et périmètre</summary><span>{definition}</span><small>{period} · {freshness}</small></details>
  </article>;
}
