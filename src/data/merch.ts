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
    image: "/brand/logo-header.jpg",
    sizes: ["S", "M", "L", "XL"],
  },
  {
    id: "wordmark-tee",
    name: "Wordmark tee",
    detail: "Black tee with the circle and the Tall Paul and Jezz name.",
    price: 35,
    image: "/brand/logo.jpg",
    sizes: ["S", "M", "L", "XL"],
  },
  {
    id: "headphones-hoodie",
    name: "Headphones hoodie",
    detail: "Black hoodie. Hood up, headphones on the chest.",
    price: 35,
    image: "/brand/merch-hoodie.jpg",
    sizes: ["S", "M", "L", "XL"],
  },
  {
    id: "headphones-crew",
    name: "Headphones crew",
    detail: "Black crewneck with headphones and glasses.",
    price: 35,
    image: "/brand/merch-crew.jpg",
    sizes: ["S", "M", "L", "XL"],
  },
  {
    id: "jackets-print",
    name: "Jackets print",
    detail: "The two jackets, side by side.",
    price: 24,
    image: "/brand/merch-jackets.jpg",
    sizes: null,
  },
];

export function formatPrice(pounds: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(pounds);
}
