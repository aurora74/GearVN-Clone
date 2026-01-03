import { Icon } from "@iconify/react";

export const renderStars = (averageRating?: number) => {
  const stars = [];
  const rating = Math.min(Math.max(averageRating ?? 0, 0), 5);

  for (let i = 1; i <= 5; i++) {
    if (i <= Math.floor(rating)) {
      stars.push(
        <Icon
          key={i}
          icon="material-symbols:star-rounded"
          fontSize={25}
          className="text-[#FF8A00]"
        />
      );
    } else if (i === Math.ceil(rating) && rating % 1 >= 0.5) {
      stars.push(
        <Icon
          key={i}
          icon="material-symbols:star-half-rounded"
          fontSize={25}
          className="text-[#FF8A00]"
        />
      );
    } else {
      stars.push(
        <Icon
          key={i}
          icon="material-symbols:star-rounded"
          fontSize={25}
          className="text-gray-300"
        />
      );
    }
  }

  return (
    <div
      className="flex items-center"
      aria-label={`Xếp hạng ${rating} trên 5 sao`}
    >
      {stars}
    </div>
  );
};
