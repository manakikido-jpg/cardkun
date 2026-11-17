import Image from "next/image";
import type { Card } from "@cardkun/shared";
export function CardImage({ card }: { card: Card }) {
  return (
    <div className="card-image">
      {card.imageUrl ? (
        <Image
          src={card.imageUrl}
          alt={card.name}
          width={180}
          height={252}
          unoptimized
        />
      ) : (
        <div role="img" aria-label={`${card.name}：画像準備中`}>
          <span className="card-symbol" aria-hidden="true">
            ✧
          </span>
          <small>画像準備中</small>
        </div>
      )}
    </div>
  );
}
