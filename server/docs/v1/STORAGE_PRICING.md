# 存储包定价 v1

规则：**10GB / 30 天 = 阿里云 OSS 标准存储月费 × 1.5**。

## 公式

```text
price_cny = bytes / 1GiB * OSS_STORAGE_CNY_PER_GIB_MONTH * 1.5
```

当前按 OSS 标准存储 `0.12 CNY/GB/月` 估算：

```text
10GB * 0.12 * 1.5 = 1.80 CNY / 30 天
```

对应 `price_minor = 180`，币种 CNY。

## 说明

- 只覆盖存储费；不含 OSS 公网流出、请求、CDN。
- 不含支付通道手续费（Stripe/Paddle 等）。
- OSS 单价随地域/存储类型变化，后台应可配置 `OSS_STORAGE_CNY_PER_GIB_MONTH`。
- 建议设置最低售价（例如 6 CNY/30 天）覆盖支付与运维成本；是否采用由运营决定。
- 套餐购买不退款；到期只读 30 天，之后删除云副本。

## SKU

```text
code: storage-10gb-30d
bytes: 10737418240
duration_days: 30
price_minor: 180
currency: CNY
```

V1 由后台手动开通；V1.1 再接支付。
