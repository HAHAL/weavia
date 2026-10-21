# 无品牌示例图生成提示词

目标：生成 6 张 WEAVIA 首页「灵感示例」图。要求真实商品摄影感、无品牌、无文字、无水印。

## 通用规范

- 画幅：4:3，建议 1200×900 或 1600×1200
- 格式：JPEG / PNG，sRGB
- 风格：高级商业静物摄影，柔和方向光，真实材质，浅景深，奶油/米白/金色调
- 禁止：文字、字母、logo、品牌名、标签、水印、人物、手、杂乱背景、过度饱和、塑料感、瓶身变形

## 负向提示词

```text
text, letters, words, typography, logo, brand name, label, watermark, signature, people, hands, clutter, distorted bottle, duplicate bottles, low resolution, oversaturated, plastic, cartoon, illustration, 3d icon
```

## 六张图

### 1. perfume.jpg

```text
Luxury product photography of an unbranded amber glass perfume bottle with a brushed gold cap, standing on a cream travertine plinth. Warm directional sunlight from the left, long soft shadow, seamless beige background, editorial still life, realistic glass refraction, high-end commercial photography, blank unlabeled bottle, no text, no logo, no watermark, 4:3.
```

### 2. skincare.jpg

```text
Minimal luxury skincare cream jar, frosted glass body with a brushed gold lid, placed on ivory linen. A single eucalyptus leaf, soft morning window light, gentle shadows, cream background, high-end editorial product photo, blank unlabeled jar, no text, no logo, no watermark, 4:3.
```

### 3. coffee.jpg

```text
Premium matte black coffee pouch with a wide brushed gold foil band, completely blank and unbranded, standing on a light oak shelf. Warm café light from the side, shallow depth of field, cream wall background, editorial packaging photography, no text, no letters, no logo, no watermark, 4:3.
```

### 4. candle.jpg

```text
Luxury amber glass candle vessel with a lit flame, on a cream marble surface. Soft warm glow, minimal beige background, elegant home fragrance product photography, realistic wax texture, blank unlabeled glass, no text, no logo, no watermark, 4:3.
```

### 5. foundation.jpg

```text
Minimal luxury foundation bottle, frosted beige glass body, black lacquer cap with a thin gold collar, lying on torn kraft paper. Clean top light, soft shadow, high-end beauty product still life, blank unlabeled bottle, no text, no logo, no watermark, 4:3.
```

### 6. serum.jpg

```text
Clear glass serum dropper bottle with a gold dropper cap, standing on wet glass. Cool blue-cream background, delicate water ripples and reflections, luxury skincare editorial photography, blank unlabeled bottle, no text, no logo, no watermark, 4:3.
```

## 放到客户端

把生成图命名为：

```text
perfume.jpg
skincare.jpg
coffee.jpg
candle.jpg
foundation.jpg
serum.jpg
```

放到：

```text
WEAVIADesktop/public/showcase/
```

然后告诉我，我会统一裁成 1200×900、更新 `src/data/showcase.ts` 并跑 E2E。
