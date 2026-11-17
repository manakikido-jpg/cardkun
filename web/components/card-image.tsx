import Image from "next/image";
import type { Card } from "@cardkun/shared";
export function CardImage({ card }: { card: Card }) {
  return (
    <div className="card-image" data-rarity={card.rarity}>
      {card.imageUrl ? (
        <Image
          src={card.imageUrl}
          alt={card.name}
          width={180}
          height={252}
          unoptimized
        />
      ) : (
        <div
          className="card-placeholder"
          role="img"
          aria-label={`${card.name}：カード画像未登録`}
        >
          <span className="placeholder-code">
            {card.setCode} / {card.rarity}
          </span>
          <span className="placeholder-emblem" aria-hidden="true">
            ✧
          </span>
          <span className="placeholder-name">{card.name}</span>
          <span className="placeholder-number">{card.number}</span>
          <small>カード画像未登録</small>
        </div>
      )}
    </div>
  );
}
