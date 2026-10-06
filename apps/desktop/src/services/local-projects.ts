export const LOCAL_PROJECT_DIRECTORIES = [
  'assets/originals',
  'outputs/images',
  'outputs/videos',
  'thumbnails',
  'cache',
  '.weavia',
] as const;
export interface LocalProjectManifest {
  version: 1;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}
export interface LocalProjectStorage {
  create(rootPath: string, manifest: LocalProjectManifest): Promise<void>;
  read(rootPath: string): Promise<LocalProjectManifest>;
  listRecent(): Promise<Array<LocalProjectManifest & { rootPath: string }>>;
}
export class BrowserMockProjectStorage implements LocalProjectStorage {
  async create(_rootPath: string, manifest: LocalProjectManifest): Promise<void> {
    localStorage.setItem(`weavia:project:${manifest.id}`, JSON.stringify(manifest));
  }
  async read(rootPath: string): Promise<LocalProjectManifest> {
    const raw = localStorage.getItem(`weavia:project:${rootPath}`);
    if (!raw) throw new Error('Project not found');
    return JSON.parse(raw) as LocalProjectManifest;
  }
  async listRecent(): Promise<Array<LocalProjectManifest & { rootPath: string }>> {
    return [];
  }
}
