type QualityInputProps = {
  quantity: number;
  decrease: () => void;
  increase: () => void;
  setQuantity: (val: number) => void;
  max?: number;
  disabled?: boolean;
};

export const QuantityInput = ({
  quantity,
  decrease,
  increase,
  setQuantity,
  max,
  disabled,
}: QualityInputProps) => {
  const isAtMinimum = quantity <= 1;
  const isAtMaximum = typeof max === "number" && quantity >= max;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = Math.max(1, Number(e.target.value));
    if (typeof max === "number") {
      setQuantity(Math.min(next, max));
      return;
    }

    setQuantity(next);
  };

  return (
    <div className="flex items-center border rounded-md">
      <button
        onClick={decrease}
        aria-label="Giảm số lượng"
        disabled={disabled || isAtMinimum}
        className="w-10 h-10 text-xl font-bold hover:bg-accent cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
      >
        -
      </button>
      <input
        min={1}
        max={max}
        type="number"
        value={quantity}
        disabled={disabled}
        onChange={handleChange}
        className="w-12 text-center outline-none disabled:opacity-70"
      />
      <button
        onClick={increase}
        aria-label="Tăng số lượng"
        disabled={disabled || isAtMaximum}
        className="w-10 h-10 text-xl font-bold hover:bg-accent cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
      >
        +
      </button>
    </div>
  );
};
