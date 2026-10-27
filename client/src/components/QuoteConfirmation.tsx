import { useEffect,useState } from 'react';
import { useQuoteConfirmation } from '../services/submission';
import { Button,Dialog } from './ui';
export function QuoteConfirmation(){
 const pending=useQuoteConfirmation(s=>s.pending);
 const [now,setNow]=useState(Date.now);
 useEffect(()=>{if(!pending)return;const t=setInterval(()=>setNow(Date.now()),1000);return ()=>clearInterval(t);},[pending]);
 if(!pending)return null;
 const total=pending.items.reduce((n,i)=>n+i.quote.totalCredits,0);
 const expired=pending.items.some(i=>Date.parse(i.quote.expiresAt)<=now);
 return <Dialog title="确认本次创作费用" onClose={()=>pending.resolve(false)}><div className="dialog-content form-stack"><p>以下价格来自服务端，已包含本次规格和账户价格。</p><div className="quote-lines">{pending.items.map(i=><div key={i.quote.id}><span>{i.title}</span><b>{i.quote.totalCredits} Credits</b></div>)}</div><div className="quote-total"><span>本次最多预占</span><strong>{total} Credits</strong></div><p>可用余额 {pending.available} Credits · 提交后可用 {Math.max(0,pending.available-total)} Credits</p><p className="field-hint">最终实扣与返还会显示在任务详情。重新生成会产生新费用；重新查看或下载已有结果不扣费。</p>{expired&&<p role="alert" className="form-error">报价已过期，请返回重新获取。</p>}{total>pending.available&&<p role="alert" className="form-error">余额不足，还需要 {total-pending.available} Credits。</p>}<div className="dialog-actions"><Button variant="secondary" onClick={()=>pending.resolve(false)}>返回修改</Button><Button disabled={expired||total>pending.available} onClick={()=>pending.resolve(true)}>确认并生成</Button></div></div></Dialog>;
}
