// The root router consults this guard before it can unmount an editor on browser history events.
let installed=null;
export function registerSchoolNavigationGuard(handler){installed=handler;return()=>{if(installed===handler)installed=null;};}
export function interceptSchoolNavigation(event){return installed?installed(event):false;}
