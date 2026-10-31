export type MerchItem = {
  id: string;
  name: string;
  detail: string;
  price: number;
  image: string | null;
  sizes: string[] | null;
};

export const merch: MerchItem[] = [
  {
    id: "poster-illustrated",
    name: "2027 tour poster",
    detail: "Illustrated flyer. House & techno, full date list.",
    price: 28,
    image: "/brand/poster.jpg",
    sizes: null,
  },
  {
    id: "poster-type",
    name: "Wordmark poster",
    detail: "Type-only tour print. Black, white, and the red year.",
    price: 24,
    image: "/brand/poster-type.jpg",
    sizes: null,
  },
  {
    id: "circle-tee",
    name: "Circle logo tee",
    detail: "Black tee with the two-silhouette mark.",
    price: 35,
    image: null,
    sizes: ["S", "M", "L", "XL"],
  },
];

export function formatPrice(pounds: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(pounds);
}
