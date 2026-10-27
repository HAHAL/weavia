import {useNavigate,useLocation} from 'react-router-dom';
import {Button,Card,StatePanel} from '../components/ui';
import {WorkDelivery} from '../components/WorkDelivery';
import {useApp} from '../stores/app';
import {taskLabel} from '../services/taskState';
import {retryLiveResult} from '../services/live';
import {exportWorks} from '../services/export';
export function CreatePage(){
 const navigate=useNavigate(),location=useLocation(),{tasks,works,notify}=useApp();
 const id=new URLSearchParams(location.search).get('task')||(location.state as {taskId?:string}|null)?.taskId;
 const task=tasks.find(t=>t.id===id);
 if(!task)return <div className="page"><StatePanel type="empty" title="选择一次创作" detail="可以从任务中心找回历史结果。" action={<Button onClick={()=>navigate('/tasks')}>查看任务</Button>}/></div>;
 const group=task.batchId?tasks.filter(t=>t.batchId===task.batchId):[task],ids=new Set(group.map(t=>t.id)),results=works.filter(w=>ids.has(w.taskId)||group.some(t=>t.workId===w.id));
 return <div className="page"><div className="page-header"><div><h1>{group.length>1?'本次商品套图':task.title}</h1><p>{results.length} 件结果可核对 · {group.length} 项任务。已提交任务可在任务中心找回。</p></div><Button variant="secondary" disabled={!results.length} onClick={()=>void exportWorks(results).then(done=>{if(done)notify('导出完成');}).catch(e=>notify(e.message))}>导出本次结果</Button></div>
 <div className="session-status-list">{group.map(t=><Card key={t.id} className="session-task"><strong>{t.title}</strong><span>{taskLabel(t)}</span>{t.billing&&<small>预占 {t.billing.reserved} · 实扣 {t.billing.consumed} · 返还 {t.billing.released} Credits</small>}{t.error&&<p className="form-error">{t.error}</p>}{t.syncError&&<p role="status">{t.syncError}</p>}<div className="card-actions">{t.source==='live'&&<Button variant="ghost" onClick={()=>retryLiveResult(t.id)}>刷新状态与结果</Button>}{t.status==='Failed'&&<Button variant="secondary" onClick={()=>navigate('/',{state:{retryPrompt:t.prompt,mode:t.mode,productId:t.product?.id,referenceAssetIds:t.referenceAssetIds,modelId:t.model,channel:t.creative?.channel,market:t.creative?.market,language:t.creative?.language}})}>调整后重新报价</Button>}</div></Card>)}</div>
 {results.length?<><p className="field-hint">下载已有结果不扣费。核对标记与修改备注当前保存在本机。</p><div className="delivery-grid">{results.map(w=><WorkDelivery key={w.id} work={w}/>)}</div></>:<StatePanel type="loading" title={group.some(t=>['Running','Queued'].includes(t.status))?'正在等待结果':'暂时没有可展示的结果'} detail="任务状态与结果文件分别核对。网络中断后可刷新恢复，无需重新生成。"/>}
 <div className="dialog-actions"><Button variant="secondary" onClick={()=>navigate('/tasks')}>任务中心</Button><Button onClick={()=>navigate('/')}>继续创作</Button></div></div>;
}
