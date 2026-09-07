import { createDemoStore, DEMO_STORAGE_KEY } from '../../demoStoreCore.js';
import { schoolApi } from './schoolApi.js';

export function clearDemoLogin(storage) {
  if(storage.getItem(DEMO_STORAGE_KEY))createDemoStore({storage}).actions.signOut();
}

export function announceSchoolLogout() {
  try{clearDemoLogin(window.localStorage);window.sessionStorage.removeItem('jde.returnTo');}catch{}
  window.dispatchEvent(new Event('jde:signed-out'));
  if(typeof BroadcastChannel!=='undefined'){
    const channel=new BroadcastChannel('jde-pilot-session');channel.postMessage('changed');channel.close();
  }
}

// Do not report logout as successful until the server has revoked its session.
export async function endSchoolSession(api=schoolApi) {
  const session=await api('/session');
  if(session.authenticated)await api('/logout',{body:{},csrf:session.csrfToken});
}
