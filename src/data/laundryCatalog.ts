export type ServiceCategory =
  | 'wash_fold'
  | 'tops_knitwear'
  | 'bottoms_dresses'
  | 'bedding_home';

export interface LaundryItem {
  id: string;
  name: string;
  category: ServiceCategory;
  categoryLabel: string;
  serviceType: 'Wash · Dry · Fold' | 'Wash & Iron' | 'Steam & Iron' | 'Gentle Wash';
  description: string;
  price: number;
  unit: string;
  featuredOnCard?: boolean;
}

export interface TimeSlot {
  id: string;
  label: string;
  window: string;
  availability: 'Available' | 'Few Slots';
}

export interface DayOption {
  iso: string;
  dayName: string;
  dateLabel: string;
  isToday: boolean;
}

export type TurnaroundSpeed = 'standard' | 'express';
export type DetergentOption = 'signature' | 'hypoallergenic';
export type WashTempOption = 'cold' | 'warm';
export type FinishOption = 'folded' | 'hangers';
export type PaymentMethod = 'paynow' | 'card' | 'cash_on_pickup';

export const LAUNDRY_CATALOG: LaundryItem[] = [
  // Wash, Dry & Fold Bags (Featured From $30 / 6kg)
  {
    id: 'wdf-6kg',
    name: 'Standard Load (6kg Bag)',
    category: 'wash_fold',
    categoryLabel: 'Wash · Dry · Fold',
    serviceType: 'Wash · Dry · Fold',
    description: 'Ideal for 1 week of everyday wear (~25–30 pieces), sorted, dried & neatly folded.',
    price: 30.0,
    unit: '/ 6kg',
    featuredOnCard: true,
  },
  {
    id: 'wdf-10kg',
    name: 'Family Load (10kg Bag)',
    category: 'wash_fold',
    categoryLabel: 'Wash · Dry · Fold',
    serviceType: 'Wash · Dry · Fold',
    description: 'Generous household load (~45 pieces) washed separately, tumble dried & crisp folded.',
    price: 46.0,
    unit: '/ 10kg',
  },
  {
    id: 'wdf-14kg',
    name: 'Jumbo Load (14kg Bag)',
    category: 'wash_fold',
    categoryLabel: 'Wash · Dry · Fold',
    serviceType: 'Wash · Dry · Fold',
    description: 'Full family wardrobe & bath towels (~65 pieces) with color separation included.',
    price: 60.0,
    unit: '/ 14kg',
  },
  {
    id: 'iron-addon',
    name: 'Standard Ironing Add-On',
    category: 'wash_fold',
    categoryLabel: 'Ironing',
    serviceType: 'Steam & Iron',
    description: 'Add crisp steam ironing to any everyday garment in your wash bag (from $2.90/item).',
    price: 2.9,
    unit: '/ item',
    featuredOnCard: true,
  },

  // Tops & Knitwear (Exact pricing from HelpMeWash rate card)
  {
    id: 'item-cardigan',
    name: 'Cardigan',
    category: 'tops_knitwear',
    categoryLabel: 'Tops & Knitwear',
    serviceType: 'Gentle Wash',
    description: 'Delicate cycle, flat dry shaping & steam finish to protect knit fibers.',
    price: 4.9,
    unit: '/ item',
    featuredOnCard: true,
  },
  {
    id: 'item-shawl',
    name: 'Shawl',
    category: 'tops_knitwear',
    categoryLabel: 'Tops & Knitwear',
    serviceType: 'Gentle Wash',
    description: 'Low-agitation hand-finish wash and gentle steam press.',
    price: 5.4,
    unit: '/ item',
    featuredOnCard: true,
  },
  {
    id: 'item-sweater',
    name: 'Sweater',
    category: 'tops_knitwear',
    categoryLabel: 'Tops & Knitwear',
    serviceType: 'Gentle Wash',
    description: 'Shape-safe wash and low-heat air dry to prevent pilling or shrinking.',
    price: 4.9,
    unit: '/ item',
    featuredOnCard: true,
  },
  {
    id: 'item-tshirt-hanger',
    name: 'T-Shirt on Hanger',
    category: 'tops_knitwear',
    categoryLabel: 'Tops & Knitwear',
    serviceType: 'Wash & Iron',
    description: 'Washed, pressed smooth and returned ready-to-wear on a hanger.',
    price: 4.9,
    unit: '/ item',
    featuredOnCard: true,
  },
  {
    id: 'item-top-blouse',
    name: 'Top / Blouse',
    category: 'tops_knitwear',
    categoryLabel: 'Tops & Knitwear',
    serviceType: 'Wash & Iron',
    description: 'Careful stain inspection, delicate wash & crisp collar/cuff steam press.',
    price: 5.9,
    unit: '/ item',
    featuredOnCard: true,
  },
  {
    id: 'item-working-shirt',
    name: 'Working Shirt on Hanger',
    category: 'tops_knitwear',
    categoryLabel: 'Tops & Knitwear',
    serviceType: 'Wash & Iron',
    description: 'Office-ready wash, crisp collar press & dust-covered hanger return.',
    price: 4.3,
    unit: '/ item',
    featuredOnCard: true,
  },

  // Bottoms & Outerwear
  {
    id: 'item-trousers',
    name: 'Trousers / Chinos',
    category: 'bottoms_dresses',
    categoryLabel: 'Bottoms & Outerwear',
    serviceType: 'Wash & Iron',
    description: 'Crease-aligned press and lint-free finish on clip hanger.',
    price: 5.2,
    unit: '/ item',
  },
  {
    id: 'item-jeans',
    name: 'Denim Jeans',
    category: 'bottoms_dresses',
    categoryLabel: 'Bottoms & Outerwear',
    serviceType: 'Gentle Wash',
    description: 'Inside-out cold wash to preserve indigo tone and denim fit.',
    price: 5.2,
    unit: '/ item',
  },
  {
    id: 'item-dress',
    name: 'Day Dress / Skirt',
    category: 'bottoms_dresses',
    categoryLabel: 'Bottoms & Outerwear',
    serviceType: 'Wash & Iron',
    description: 'Gentle wash and vertical steam finishing for flowing fabrics.',
    price: 7.5,
    unit: '/ item',
  },
  {
    id: 'item-jacket',
    name: 'Light Jacket / Blazer',
    category: 'bottoms_dresses',
    categoryLabel: 'Bottoms & Outerwear',
    serviceType: 'Gentle Wash',
    description: 'Structured shoulder-safe clean and steam refresh.',
    price: 9.5,
    unit: '/ item',
  },

  // Bedding & Home
  {
    id: 'home-bedsheet',
    name: 'Bedsheet & 2 Pillowcases',
    category: 'bedding_home',
    categoryLabel: 'Bedding & Home',
    serviceType: 'Wash · Dry · Fold',
    description: 'Sanitizing warm wash, high-loft dry and crisp square fold.',
    price: 12.0,
    unit: '/ set',
  },
  {
    id: 'home-duvet',
    name: 'Duvet / Quilt Cover',
    category: 'bedding_home',
    categoryLabel: 'Bedding & Home',
    serviceType: 'Wash · Dry · Fold',
    description: 'Deep clean and thorough tumble dry for Queen or King covers.',
    price: 16.0,
    unit: '/ piece',
  },
  {
    id: 'home-towels',
    name: 'Bath Towel Bundle (4 pcs)',
    category: 'bedding_home',
    categoryLabel: 'Bedding & Home',
    serviceType: 'Wash · Dry · Fold',
    description: 'Fluffy, soft-tumbled bath towels folded neatly for your linen shelf.',
    price: 11.0,
    unit: '/ bundle',
  },
];

export const TOPS_KNITWEAR_RATES = [
  { id: 'item-cardigan', service: 'Cardigan', price: 4.9 },
  { id: 'item-shawl', service: 'Shawl', price: 5.4 },
  { id: 'item-sweater', service: 'Sweater', price: 4.9 },
  { id: 'item-tshirt-hanger', service: 'T-Shirt on Hanger', price: 4.9 },
  { id: 'item-top-blouse', service: 'Top / Blouse', price: 5.9 },
  { id: 'item-working-shirt', service: 'Working Shirt on Hanger', price: 4.3 },
];

export const TIME_SLOTS: TimeSlot[] = [
  { id: 'morning', label: 'Morning', window: '09:00 – 11:00', availability: 'Available' },
  { id: 'midday', label: 'Midday', window: '12:00 – 14:00', availability: 'Available' },
  { id: 'afternoon', label: 'Afternoon', window: '15:00 – 17:00', availability: 'Few Slots' },
  { id: 'evening', label: 'Evening', window: '18:00 – 20:00', availability: 'Available' },
];

export function getUpcomingDays(count = 7): DayOption[] {
  const days: DayOption[] = [];
  const base = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const dayName =
      i === 0
        ? 'Today'
        : i === 1
          ? 'Tomorrow'
          : d.toLocaleDateString('en-US', { weekday: 'short' });
    const dateLabel = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
    days.push({
      iso,
      dayName,
      dateLabel,
      isToday: i === 0,
    });
  }
  return days;
}

export function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}
