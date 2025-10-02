import React from "react";
import { getItemName } from "../utils/format";

const itemIconUrl = (id: number, ver: string) =>
  `https://ddragon.leagueoflegends.com/cdn/${ver}/img/item/${id}.png`;

interface ItemIconProps {
  id: number;
  ver: string;
  size?: number;
}

const ItemIcon: React.FC<ItemIconProps> = ({ id, ver, size = 22 }) => {
  const [name, setName] = React.useState<string>(`Item ${id}`);

  React.useEffect(() => {
    if (id) {
      getItemName(id, ver).then(setName);
    }
  }, [id, ver]);

  if (!id) {
    return (
      <div
        className="item-slot empty"
        style={{ width: size, height: size }}
        title="Empty slot"
        aria-hidden="true"
      />
    );
  }

  return (
    <img
      className="item-slot"
      src={itemIconUrl(id, ver)}
      alt={name}
      title={name}
      width={size}
      height={size}
      loading="lazy"
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
      }}
    />
  );
};

export default ItemIcon;
