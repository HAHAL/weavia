import { ResourcePage } from '../../components/resource-page';
export default function Page(){return <ResourcePage title="任务记录" description="Task、运行尝试、成本与结算关联" columns={[{key:'task',label:'任务'},{key:'type',label:'类型'},{key:'cost',label:'Credits'},{key:'status',label:'状态'}]}/>}
