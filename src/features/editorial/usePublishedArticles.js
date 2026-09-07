import {useCallback,useEffect,useRef,useState} from 'react';
export async function publicArticleRequest(path,signal){
  let response;try{response=await fetch('/api/public/articles'+path,{credentials:'omit',cache:'no-store',signal});}catch(error){if(error.name==='AbortError')throw error;throw new Error('Les publications ne peuvent pas être chargées pour le moment.');}
  let data;try{data=await response.json();}catch{throw new Error('Les publications ne peuvent pas être chargées pour le moment.');}
  if(!response.ok){const error=new Error(data.error?.message||'Publication indisponible.');error.status=response.status;throw error;}return data;
}
export function usePublishedArticles({enabled=true,q='',category='Tous'}={}){
  const [data,setData]=useState({items:[],nextOffset:null}),[loading,setLoading]=useState(enabled),[error,setError]=useState(''),[refresh,setRefresh]=useState(0);
  const sequence=useRef(0),active=useRef(false);
  const load=useCallback(async(offset=0,revision)=>{const version=++sequence.current;setLoading(true);setError('');try{const result=await publicArticleRequest('?'+new URLSearchParams({q,category,offset:String(offset),...(revision?{revision}:{})}));if(version===sequence.current&&active.current)setData(previous=>({...result,items:offset?[...new Map([...previous.items,...result.items].map(entry=>[entry.slug,entry])).values()]:result.items}));}catch(e){if(version===sequence.current&&active.current){setError(e.message);setData({items:[],nextOffset:null});}}finally{if(version===sequence.current&&active.current)setLoading(false);}},[q,category]);
  useEffect(()=>{active.current=true;setData({items:[],nextOffset:null});if(enabled)load();else setLoading(false);return()=>{active.current=false;++sequence.current;};},[load,enabled,refresh]);
  useEffect(()=>{if(!enabled)return;const update=()=>{if(document.visibilityState==='visible')setRefresh(value=>value+1);};window.addEventListener('focus',update);document.addEventListener('visibilitychange',update);return()=>{window.removeEventListener('focus',update);document.removeEventListener('visibilitychange',update);};},[enabled]);
  return {...(enabled?data:{items:[],nextOffset:null}),loading:enabled&&loading,error:enabled?error:'',retry:()=>setRefresh(value=>value+1),more:()=>{if(enabled&&!loading&&data.nextOffset!==null)load(data.nextOffset,data.revision);}};
}
export function usePublishedArticle(slug,enabled){
  const [state,setState]=useState({article:null,loading:enabled,error:'',status:null}),[refresh,setRefresh]=useState(0);
  useEffect(()=>{if(!enabled){setState({article:null,loading:false,error:'',status:null});return;}const controller=new AbortController();let active=true;setState({slug,article:null,loading:true,error:'',status:null});publicArticleRequest('/'+encodeURIComponent(slug),controller.signal).then(data=>{if(active)setState({slug,article:data.article,loading:false,error:'',status:200});}).catch(e=>{if(active&&e.name!=='AbortError')setState({slug,article:null,loading:false,error:e.message,status:e.status});});return()=>{active=false;controller.abort();};},[slug,enabled,refresh]);
  useEffect(()=>{if(!enabled)return;const update=()=>{if(document.visibilityState==='visible')setRefresh(value=>value+1);};window.addEventListener('focus',update);document.addEventListener('visibilitychange',update);return()=>{window.removeEventListener('focus',update);document.removeEventListener('visibilitychange',update);};},[enabled]);
  return {...(enabled&&state.slug===slug?state:{article:null,loading:enabled,error:'',status:null}),retry:()=>setRefresh(value=>value+1)};
}
