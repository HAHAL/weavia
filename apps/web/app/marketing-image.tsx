import Image from 'next/image';

type EditorialImage = 'coat-product' | 'coat-model' | 'coat-outdoor' | 'coat-detail' | 'perfume-product' | 'perfume-scene' | 'perfume-detail' | 'perfume-shadow';
type ImageRatio = 'hero' | 'product' | 'gallery';

export function MarketingImage({ image, alt, ratio, className = '' }: { image: EditorialImage; alt: string; ratio: ImageRatio; className?: string }) {
  return <div className={`marketing-image marketing-image--${ratio} marketing-image--${image} ${className}`}>
    <Image src={`/images/editorial/${image}.png`} alt={alt} fill sizes={ratio === 'hero' ? '(max-width: 700px) 100vw, 50vw' : '(max-width: 700px) 100vw, 33vw'} />
  </div>;
}
