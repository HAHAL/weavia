import { ResourcePage } from '../../components/resource-page';
export default function Page(){return <ResourcePage title="会员管理" description="套餐、有效期与权益快照" columns={[{key:'user',label:'用户'},{key:'plan',label:'套餐'},{key:'expires',label:'有效期'},{key:'status',label:'状态'}]}/>}
