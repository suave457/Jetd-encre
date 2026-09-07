// Synthetic catalogue fixture, explicitly prepared from the hidden local test tools.
// No real school book, file, licence or identity is imported or substituted.
export const RECIPE_MANUAL = Object.freeze({id:'beta-recette-manuel-5aep',title:'Cahier de recette BETA · contenu fictif',level:'5e AEP · test'});
export async function prepareLocalRecipe(DB) {
  await DB.prepare('INSERT OR IGNORE INTO pilot_manuals(id,title,level,active) VALUES (?,?,?,1)').bind(RECIPE_MANUAL.id,RECIPE_MANUAL.title,RECIPE_MANUAL.level).run();
  return {ok:true,manualId:RECIPE_MANUAL.id,message:'Catalogue de recette préparé. Ce titre fictif sert uniquement à tester les codes et les droits ; il ne contient pas de manuel scolaire à lire.'};
}
