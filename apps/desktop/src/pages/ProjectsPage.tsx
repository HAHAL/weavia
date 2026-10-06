import { Button, EmptyState, PageHeader } from '@weavia/ui';
import { FolderPlus } from 'lucide-react';
export function ProjectsPage(){return <><PageHeader eyebrow="LOCAL PROJECTS" title="项目" description="项目与素材优先保存在你的电脑。" action={<Button><FolderPlus size={15}/> 新建项目</Button>}/><div className="page-card"><EmptyState title="暂无本地项目" description="创建第一个项目，WEAVIA 会建立标准目录并在本地保存素材与生成结果。" action={<Button>创建第一个项目</Button>}/></div></>}
