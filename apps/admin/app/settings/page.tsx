import { ResourcePage } from '../../components/resource-page';
export default function Page(){return <ResourcePage title="系统配置" description="Feature Flag、应用版本与系统参数" columns={[{key:'key',label:'配置项'},{key:'value',label:'值'},{key:'updated',label:'更新时间'},{key:'status',label:'状态'}]}/>}
