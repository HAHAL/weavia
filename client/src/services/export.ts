import { isTauri } from '@tauri-apps/api/core';
import { reviewOf } from '../lib/review';
import { save as saveDialog } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { createZip, type ZipEntry } from '../lib/zip';
import { useApp } from '../stores/app';
import type { Work } from '../types';

export type ExportResult = { filename: string; saved: boolean; count: number; skipped: string[] };

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function stamp(date = new Date()): string {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}

function safeName(value: string, fallback: string): string {
  const cleaned = value.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return cleaned.slice(0, 60) || fallback;
}

function extension(mime?: string, mode?: string): string {
  if (mode === 'video') return mime === 'video/webm' ? 'webm' : 'mp4';
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/webp') return 'webp';
  return 'png';
}

async function bytesForWork(work: Work): Promise<{ data: Uint8Array; mime?: string } | null> {
  const version = work.versions.at(-1);
  if (!version) return null;
  let source = version.dataUrl;
  if (!source && version.assetId) {
    const asset = useApp.getState().assets.find(item => item.id === version.assetId);
    source = asset?.dataUrl;
  }
  if (!source) return null;
  try {
    const response = await fetch(source);
    if (!response.ok) return null;
    return { data: new Uint8Array(await response.arrayBuffer()), mime: version.mimeType };
  } catch {
    return null;
  }
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export async function exportSet(works: Work[]): Promise<ExportResult> {
  const entries: ZipEntry[] = [];
  const rows: string[][] = [['文件名', '商品', 'SKU', '用途', '版本', '核对状态', '提示词']];
  const skipped: string[] = [];
  let index = 0;

  for (const work of works) {
    const bytes = await bytesForWork(work);
    if (!bytes) { skipped.push(work.title); continue; }
    index += 1;
    const version = work.versions.at(-1)!;
    const name = `${pad(index)}-${safeName(work.title, 'work')}.${extension(version.mimeType, work.mode)}`;
    entries.push({ name, data: bytes.data });
    rows.push([
      name,
      work.product?.name || '',
      work.product?.sku || '',
      work.mode === 'image' ? '图片' : '视频',
      `v${work.versions.length}`,
      reviewOf(work) === 'approved' ? '已通过' : reviewOf(work) === 'changes_needed' ? '需修改' : '待核对',
      version.prompt || '',
    ]);
  }

  if (!entries.length) return { filename: '', saved: false, count: 0, skipped };

  const now = new Date();
  const manifest = {
    app: 'WEAVIA',
    version: 1,
    exportedAt: now.toISOString(),
    count: entries.length,
    items: works.filter(work => entries.some(entry => entry.name.includes(safeName(work.title, 'work')))).map(work => ({
      file: entries.find(entry => entry.name.includes(safeName(work.title, 'work')))?.name,
      title: work.title,
      product: work.product?.name || '',
      sku: work.product?.sku || '',
      mode: work.mode,
      versions: work.versions.length,
      reviewStatus: reviewOf(work),
      taskId: work.taskId,
      prompt: work.versions.at(-1)?.prompt || '',
    })),
  };

  entries.push({ name: 'manifest.json', data: new TextEncoder().encode(JSON.stringify(manifest, null, 2)) });
  const csv = '\ufeff' + rows.map(row => row.map(csvCell).join(',')).join('\n');
  entries.push({ name: '审核清单.csv', data: new TextEncoder().encode(csv) });

  const zip = createZip(entries, now);
  const filename = `weavia-${stamp(now)}.zip`;

  if (isTauri()) {
    const path = await saveDialog({ defaultPath: filename, filters: [{ name: 'ZIP', extensions: ['zip'] }] });
    if (!path) return { filename, saved: false, count: entries.length - 2, skipped };
    await writeFile(path, zip);
    return { filename: path, saved: true, count: entries.length - 2, skipped };
  }

  const blob = new Blob([zip.buffer as ArrayBuffer], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
  return { filename, saved: true, count: entries.length - 2, skipped };
}
