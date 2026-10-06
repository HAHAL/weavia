import { ResourcePage } from '../../components/resource-page';
export default function Page(){return <ResourcePage title="Credits 管理" description="钱包余额与不可变交易流水" columns={[{key:'wallet',label:'钱包'},{key:'available',label:'可用'},{key:'frozen',label:'冻结'},{key:'status',label:'状态'}]}/>}
