import { Badge, PageHeader } from '@weavia/ui';
export interface Column { key: string; label: string; }
export function ResourcePage({title,description,columns}: {title:string;description:string;columns:Column[]}){return <><PageHeader eyebrow="ADMIN" title={title} description={description}/><table className="data-table"><thead><tr>{columns.map((c)=><th key={c.key}>{c.label}</th>)}</tr></thead><tbody><tr>{columns.map((c,index)=><td key={c.key}>{index===0?'暂无数据':index===columns.length-1?<Badge>未连接</Badge>:'—'}</td>)}</tr></tbody></table></>}
