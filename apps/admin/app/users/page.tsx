import { ResourcePage } from '../../components/resource-page';
export default function Page(){return <ResourcePage title="用户管理" description="用户状态、账户与注册信息" columns={[{key:'user',label:'用户'},{key:'email',label:'邮箱'},{key:'created',label:'注册时间'},{key:'status',label:'状态'}]}/>}
