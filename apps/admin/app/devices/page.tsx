import { ResourcePage } from '../../components/resource-page';
export default function Page(){return <ResourcePage title="设备管理" description="设备授权与最近活跃记录" columns={[{key:'device',label:'设备'},{key:'platform',label:'平台'},{key:'active',label:'最近活跃'},{key:'status',label:'状态'}]}/>}
