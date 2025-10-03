import React from "react";
import ItemIcon from "./ItemIcon";

const ItemsGrid: React.FC<{ slots: number[]; ver: string }> = ({
  slots,
  ver,
}) => {
  const six = [...slots];
  while (six.length < 6) six.push(0);

  return (
    <div className="items-grid" aria-label="Items">
      {six.map((id, i) => (
        <ItemIcon key={i} id={id} ver={ver} />
      ))}
    </div>
  );
};

export default ItemsGrid;
