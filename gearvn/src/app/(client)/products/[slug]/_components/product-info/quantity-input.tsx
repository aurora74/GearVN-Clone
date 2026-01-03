type QualityInputProps = {
  quantity: number;
  decrease: () => void;
  increase: () => void;
  setQuantity: (val: number) => void;
};

export const QuantityInput = ({
  quantity,
  decrease,
  increase,
  setQuantity,
}: QualityInputProps) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuantity(Math.max(1, Number(e.target.value)));
  };

  return (
    <div className="flex items-center border rounded-md">
      <button
        onClick={decrease}
        aria-label="Giảm số lượng"
        className="w-10 h-10 text-xl font-bold hover:bg-accent cursor-pointer"
      >
        -
      </button>
      <input
        min={1}
        type="number"
        value={quantity}
        onChange={handleChange}
        className="w-12 text-center outline-none"
      />
      <button
        onClick={increase}
        aria-label="Tăng số lượng"
        className="w-10 h-10 text-xl font-bold hover:bg-accent cursor-pointer"
      >
        +
      </button>
    </div>
  );
};
