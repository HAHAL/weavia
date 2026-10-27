import {useState} from 'react';
import {useNavigate,useSearchParams} from 'react-router-dom';
import {Button,StatePanel} from '../components/ui';
import {WorkDelivery} from '../components/WorkDelivery';
import {useApp} from '../stores/app';
import {useAuth} from '../stores/auth';
import {startupSync} from '../services/sync';
import {exportWorks} from '../services/export';
export function Works(){
 const {works,notify}=useApp(),user=useAuth(s=>s.user),navigate=useNavigate();
 const [params]=useSearchParams();const taskId=params.get('task');
 const [query,setQuery]=useState(''),[review,setReview]=useState('all'),[selected,setSelected]=useState<string[]>([]),[busy,setBusy]=useState(false),[page,setPage]=useState(0);
 const filtered=works.filter(w=>(!taskId||w.taskId===taskId)&&(!query||w.title.toLowerCase().includes(query.toLowerCase()))&&(review==='all'||(w.reviewStatus||'pending')===review));
 const visible=filtered.slice(page*12,page*12+12);
 async function exportSelected(){setBusy(true);try{if(await exportWorks(works.filter(w=>selected.includes(w.id))))notify('所选作品已打包导出');}catch(e){notify(e instanceof Error?e.message:'导出失败');}finally{setBusy(false);}}
 return <div className="page"><div className="page-header"><div><h1>作品中心</h1><p>核对商品，保留修改版本，下载可用素材。</p></div><div className="header-actions"><Button variant="secondary" onClick={()=>{if(user)void startupSync(user.id).catch(()=>notify('同步失败，请检查连接'));}}>刷新云端结果</Button><Button onClick={()=>navigate('/')}>新建创作</Button></div></div><div className="filter-bar"><input aria-label="搜索作品" placeholder="搜索作品名称" value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}}/><select aria-label="核对状态" value={review} onChange={e=>{setReview(e.target.value);setPage(0);}}><option value="all">全部状态</option><option value="pending">待核对</option><option value="approved">已核对</option><option value="changes_needed">需修改</option></select><Button variant="secondary" disabled={!selected.length||busy} onClick={()=>void exportSelected()}>{busy?'正在打包…':`导出所选${selected.length?'（'+selected.length+'）':''}`}</Button></div>
 {filtered.length?<><div className="delivery-grid">{visible.map(w=><div key={w.id}><label className="work-select"><input type="checkbox" checked={selected.includes(w.id)} onChange={e=>setSelected(v=>e.target.checked?[...v,w.id]:v.filter(id=>id!==w.id))}/>选择 {w.title}</label><WorkDelivery work={w}/></div>)}</div><div className="pagination"><Button variant="secondary" disabled={!page} onClick={()=>setPage(p=>p-1)}>上一页</Button><span>{page+1} / {Math.ceil(filtered.length/12)} · 共 {filtered.length} 件</span><Button variant="secondary" disabled={(page+1)*12>=filtered.length} onClick={()=>setPage(p=>p+1)}>下一页</Button></div></>:<StatePanel type="empty" title={works.length?'没有匹配的作品':'还没有可展示的作品'} detail="完成生成后，结果会显示在这里。已有云端任务时可刷新结果，或到任务中心查看恢复情况。" action={<Button onClick={()=>navigate('/tasks')}>查看任务</Button>}/>}
 </div>;
}
