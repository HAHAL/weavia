# WEAVIA UI Foundation V1.0

Shared React components and semantic CSS tokens for Web, Admin and Desktop. Import `@weavia/ui/styles.css` once in the app entry/layout. The stylesheet imports `tokens.css`; existing `--wv-*` aliases remain available.

The repository currently uses shared CSS rather than Tailwind or shadcn/ui. These components keep that stack intact. If Tailwind is introduced later, map its theme variables to `--wv-color-*`, `--wv-space-*`, `--wv-radius-*`, and `--wv-font-*` without duplicating values.

## Tokens

- Colors: `--wv-color-canvas`, `--wv-color-surface`, `--wv-color-text-primary`, `--wv-color-text-secondary`, `--wv-color-border`, `--wv-color-accent`, `--wv-color-action`, and semantic success/warning/danger/info.
- Typography: `--wv-font-sans`, `--wv-font-editorial`, `--wv-font-size-*`, `--wv-line-height-*`.
- Spacing: `--wv-space-1/2/3/4/6/8/12/16/24` = 4/8/12/16/24/32/48/64/96px.
- Radius: `--wv-radius-control/image/card/modal` = 4/4/6/8px.
- Set `data-theme="dark"` on the document root for the dark semantic palette. Dark mode must still be visually reviewed in each application before release.

## Components

```tsx
import { Badge, Button, Card, Input, Modal, Table, TableContainer, Tabs, Toast } from '@weavia/ui';

<Button variant="primary" size="md" loading={saving}>保存</Button>
<Input aria-label="邮箱" type="email" invalid={Boolean(error)} aria-describedby={error ? 'email-error' : undefined} />
<Card className="summary-card">内容</Card>
<Badge tone="success">已完成</Badge>

<TableContainer>
  <Table>
    <caption>任务</caption>
    <thead><tr><th scope="col">名称</th><th scope="col">状态</th></tr></thead>
    <tbody><tr><td>商品图</td><td>已完成</td></tr></tbody>
  </Table>
</TableContainer>

<Modal open={open} onClose={() => setOpen(false)} title="确认操作" footer={<Button onClick={confirm}>确认</Button>}>
  请检查操作内容。
</Modal>

<Tabs label="账户设置" items={[
  { value: 'profile', label: '资料', content: <div>个人资料</div> },
  { value: 'security', label: '安全', content: <div>安全设置</div> },
]} />

{showToast && <Toast title="已保存" tone="success" onDismiss={() => setShowToast(false)} />}
```

`Modal`, `Tabs` and `Toast` are client components. The consumer controlling their state must also be a client component in Next.js. `Toast` is an individual notification; place it in the application's notification region. Error toasts stay visible until dismissed. `Table` is a semantic table wrapper; sorting, filtering and pagination belong to the consuming feature. Provide accessible labels for icon-only buttons and inputs.
