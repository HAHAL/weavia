import { AIAdminView } from '../../../components/ai-admin';
export default async function Page({ params }: { params: Promise<{ providerId: string }> }) {
  return <AIAdminView view="provider" providerId={(await params).providerId} />;
}
