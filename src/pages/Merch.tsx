import { useState } from "react";
import { formatPrice, merch, type MerchItem } from "../data/merch";
import type { BagLine } from "../storage";

export default function MerchPage({
  bag,
  setBag,
}: {
  bag: BagLine[];
  setBag: (value: BagLine[] | ((current: BagLine[]) => BagLine[])) => void;
}) {
  const [sizes, setSizes] = useState<Record<string, string>>({});
  const [merchError, setMerchError] = useState("");
  const total = bag.reduce((sum, line) => {
    const item = merch.find((entry) => entry.id === line.merchId);
    return sum + (item ? item.price * line.qty : 0);
  }, 0);

  function addToBag(item: MerchItem) {
    const size = item.sizes ? sizes[item.id] ?? "" : null;
    if (item.sizes && !size) {
      setMerchError(`Pick a size for the ${item.name.toLowerCase()}.`);
      return;
    }
    setMerchError("");
    setBag((current) => {
      const index = current.findIndex((line) => line.merchId === item.id && line.size === size);
      if (index === -1) return [...current, { merchId: item.id, qty: 1, size }];
      return current.map((line, i) =>
        i === index ? { ...line, qty: Math.min(6, line.qty + 1) } : line,
      );
    });
  }

  function changeQty(index: number, delta: number) {
    setBag((current) =>
      current.flatMap((line, i) => {
        if (i !== index) return [line];
        const qty = line.qty + delta;
        if (qty < 1) return [];
        return [{ ...line, qty: Math.min(6, qty) }];
      }),
    );
  }

  return (
    <section className="block">
      <div className="wrap">
        <p className="kicker">Prints and a tee</p>
        <h1 className="section-title">Merch</h1>
        <p className="lede">
          Prices in pounds. The till is not taking payment yet. The bag stays in this browser.
        </p>
        {merchError ? (
          <p className="form-error" role="alert">
            {merchError}
          </p>
        ) : null}
        <div className="merch-grid">
          {merch.map((item) => (
            <Product
              key={item.id}
              item={item}
              size={sizes[item.id] ?? ""}
              onSize={(size) => {
                setSizes((current) => ({ ...current, [item.id]: size }));
                setMerchError("");
              }}
              onAdd={() => addToBag(item)}
            />
          ))}
        </div>
        <Bag bag={bag} total={total} onQty={changeQty} />
      </div>
    </section>
  );
}

function Product({
  item,
  size,
  onSize,
  onAdd,
}: {
  item: MerchItem;
  size: string;
  onSize: (size: string) => void;
  onAdd: () => void;
}) {
  return (
    <article className="product">
      {item.image ? (
        <img src={item.image} alt="" />
      ) : (
        <div className="tee-print">
          <img src="/brand/logo-mark.jpg" alt="" />
        </div>
      )}
      <div className="product-body">
        <div>
          <h3>{item.name}</h3>
          <p>{item.detail}</p>
        </div>
        <div className="price">{formatPrice(item.price)}</div>
        {item.sizes ? (
          <div>
            <span className="size-label" id={`${item.id}-size`}>
              Size
            </span>
            <div className="choice-row" role="group" aria-labelledby={`${item.id}-size`}>
              {item.sizes.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={size === option ? "is-on" : ""}
                  aria-pressed={size === option}
                  onClick={() => onSize(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <button className="btn" type="button" onClick={onAdd}>
          Add to bag
        </button>
      </div>
    </article>
  );
}

function Bag({
  bag,
  total,
  onQty,
}: {
  bag: BagLine[];
  total: number;
  onQty: (index: number, delta: number) => void;
}) {
  return (
    <div className="bag" aria-live="polite">
      <h3>Bag{bag.length > 0 ? ` · ${formatPrice(total)}` : ""}</h3>
      {bag.length === 0 ? (
        <p>Nothing in the bag.</p>
      ) : (
        bag.map((line, index) => {
          const item = merch.find((entry) => entry.id === line.merchId);
          if (!item) return null;
          return (
            <div className="bag-line" key={`${line.merchId}-${line.size ?? "one"}`}>
              <div>
                <strong>
                  {item.name}
                  {line.size ? ` · ${line.size}` : ""}
                </strong>
                <span className="fine">{formatPrice(item.price * line.qty)}</span>
              </div>
              <div className="qty-ctl">
                <button type="button" onClick={() => onQty(index, -1)} aria-label={`Fewer ${item.name}`}>
                  −
                </button>
                <span>{line.qty}</span>
                <button type="button" onClick={() => onQty(index, 1)} aria-label={`More ${item.name}`}>
                  +
                </button>
              </div>
              <button className="text-btn" type="button" onClick={() => onQty(index, -line.qty)}>
                Remove
              </button>
            </div>
          );
        })
      )}
      <p className="fine">Held in this browser. Nothing is charged.</p>
    </div>
  );
}
