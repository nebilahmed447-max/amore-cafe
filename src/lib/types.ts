export type Category = string;

export type Product = {
  id: string;
  name: string;
  amharic: string;
  category: Category;
  price: number;
  image: string;
  description: string;
  prepTime: number;
  popular?: boolean;
  fasting?: boolean;
  available: boolean;
};

export type CartItem = Product & { quantity: number };

export type Order = {
  id: string;
  createdAt: string;
  customer: { name: string; phone: string; address?: string; notes?: string };
  items: CartItem[];
  orderType: "delivery" | "pickup";
  deliveryZone?: "Free" | "Near" | "Medium" | "Far";
  deliveryFee: number;
  deliveryDistanceKm?: number;
  deliveryLat?: number;
  deliveryLng?: number;
  total: number;
  status: "Pending" | "Confirmed" | "Preparing" | "Ready" | "Completed" | "Cancelled";
  payment: "Cash" | "CBE" | "BOA" | "Tele Birr";
  receiptUrl?: string;
};
