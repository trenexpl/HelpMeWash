import { useEffect, useMemo, useState } from 'react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  Calendar,
  Clock,
  Check,
  Minus,
  Plus,
  CreditCard,
  QrCode,
  Banknote,
  ArrowLeft,
  ArrowRight,
  Copy,
  MessageCircle,
  Truck,
  Sparkles,
  AlertCircle,
  ShoppingBag,
  Award,
  LogOut,
} from 'lucide-react';
import {
  TIME_SLOTS,
  getUpcomingDays,
  formatCurrency,
  type ServiceCategory,
  type TurnaroundSpeed,
  type DetergentOption,
  type WashTempOption,
  type FinishOption,
  type PaymentMethod,
} from '../data/laundryCatalog';
import { useFirebase } from '../contexts/FirebaseContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';

export interface CustomerDetails {
  fullName: string;
  phone: string;
  address: string;
  postalCode: string;
  notes: string;
}

export interface ConfirmedOrder {
  orderId: string;
  createdAt: string;
  pickupDayLabel: string;
  pickupWindow: string;
  turnaround: TurnaroundSpeed;
  isGuest: boolean;
  customerEmail: string;
  customer: CustomerDetails;
  items: { id: string; name: string; qty: number; unitPrice: number }[];
  detergent: DetergentOption;
  washTemp: WashTempOption;
  finish: FinishOption;
  paymentMethod: PaymentMethod;
  subtotal: number;
  loyaltyDiscountRate: number;
  loyaltyDiscountAmount: number;
  deliveryFee: number;
  expressFee: number;
  total: number;
}

interface BookingWizardProps {
  activeStep: 1 | 2 | 3;
  onStepChange: (step: 1 | 2 | 3) => void;
  quantities: Record<string, number>;
  onUpdateQuantity: (itemId: string, delta: number) => void;
  onResetBooking: () => void;
  onOpenAccount: () => void;
}

const CATEGORY_TABS: { id: 'all' | ServiceCategory; label: string }[] = [
  { id: 'all', label: 'All Services' },
  { id: 'wash_fold', label: 'Wash · Dry · Fold' },
  { id: 'tops_knitwear', label: 'Tops & Knitwear' },
  { id: 'bottoms_dresses', label: 'Bottoms & Outerwear' },
  { id: 'bedding_home', label: 'Bedding & Home' },
];

export function BookingWizard({
  activeStep,
  onStepChange,
  quantities,
  onUpdateQuantity,
  onResetBooking,
  onOpenAccount,
}: BookingWizardProps) {
  const { user, userProfile, services, siteConfig, signInWithGoogle, signOutUser, updateOwnProfile } =
    useFirebase();
  const days = useMemo(() => getUpcomingDays(7), []);

  // Step 1 state
  const [selectedDayIso, setSelectedDayIso] = useState<string>(days[1]?.iso ?? days[0].iso);
  const [selectedSlotId, setSelectedSlotId] = useState<string>(TIME_SLOTS[0].id);
  const [turnaround, setTurnaround] = useState<TurnaroundSpeed>('standard');
  const [customer, setCustomer] = useState<CustomerDetails>({
    fullName: '',
    phone: '',
    address: '',
    postalCode: '',
    notes: '',
  });
  const [step1Errors, setStep1Errors] = useState<Partial<Record<keyof CustomerDetails, string>>>({});

  // Pre-fill empty pickup fields when signed-in customer profile loads
  useEffect(() => {
    if (!userProfile) return;
    setCustomer((prev) => ({
      fullName: prev.fullName || userProfile.displayName || '',
      phone: prev.phone || userProfile.phone || '',
      address: prev.address || userProfile.address || '',
      postalCode: prev.postalCode || userProfile.postalCode || '',
      notes: prev.notes,
    }));
  }, [userProfile]);

  // Step 2 state
  const [categoryFilter, setCategoryFilter] = useState<'all' | ServiceCategory>('all');
  const [detergent, setDetergent] = useState<DetergentOption>('signature');
  const [washTemp, setWashTemp] = useState<WashTempOption>('cold');
  const [finish, setFinish] = useState<FinishOption>('folded');
  const [step2Error, setStep2Error] = useState<string>('');

  // Step 3 state
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('paynow');
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<ConfirmedOrder | null>(null);
  const [copiedReceipt, setCopiedReceipt] = useState(false);

  const selectedDay = days.find((d) => d.iso === selectedDayIso) ?? days[0];
  const selectedSlot = TIME_SLOTS.find((s) => s.id === selectedSlotId) ?? TIME_SLOTS[0];

  const activeCatalog = useMemo(
    () => services.filter((s) => s.isActive),
    [services]
  );

  const selectedItems = useMemo(() => {
    return activeCatalog
      .filter((item) => (quantities[item.id] ?? 0) > 0)
      .map((item) => ({
        ...item,
        qty: quantities[item.id],
        lineTotal: item.price * quantities[item.id],
      }));
  }, [activeCatalog, quantities]);

  const totalItemCount = useMemo(
    () => selectedItems.reduce((sum, item) => sum + item.qty, 0),
    [selectedItems]
  );

  const subtotal = useMemo(
    () => selectedItems.reduce((sum, item) => sum + item.lineTotal, 0),
    [selectedItems]
  );

  const isLoyaltySignedIn = Boolean(user && user.emailVerified);
  const loyaltyDiscountRate = isLoyaltySignedIn
    ? Math.max(0, Math.min(0.25, siteConfig.loyaltyDiscountPercent / 100))
    : 0;
  const loyaltyDiscountAmount = Number((subtotal * loyaltyDiscountRate).toFixed(2));

  const deliveryFee =
    subtotal === 0
      ? 0
      : subtotal >= siteConfig.freeDeliveryThreshold
        ? 0
        : siteConfig.standardDeliveryFee;
  const expressFee = turnaround === 'express' && subtotal > 0 ? siteConfig.expressFee : 0;
  const grandTotal = Math.max(
    0,
    Number((subtotal - loyaltyDiscountAmount + deliveryFee + expressFee).toFixed(2))
  );

  const filteredCatalog = useMemo(() => {
    if (categoryFilter === 'all') return activeCatalog;
    return activeCatalog.filter((item) => item.category === categoryFilter);
  }, [activeCatalog, categoryFilter]);

  function validateStep1(): boolean {
    const errors: Partial<Record<keyof CustomerDetails, string>> = {};
    if (!customer.fullName.trim()) errors.fullName = 'Please enter your name.';
    const digits = customer.phone.replace(/\D/g, '');
    if (digits.length < 8) errors.phone = 'Enter a valid 8-digit mobile or WhatsApp number.';
    if (!customer.address.trim()) errors.address = 'Please enter your street & unit number.';
    if (customer.postalCode.trim().length < 5) {
      errors.postalCode = 'Enter a valid postal code.';
    }
    setStep1Errors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleContinueFromStep1() {
    if (validateStep1()) {
      onStepChange(2);
    }
  }

  function handleContinueFromStep2() {
    if (totalItemCount === 0) {
      setStep2Error('Please add at least one wash bag or garment before proceeding to payment.');
      return;
    }
    setStep2Error('');
    onStepChange(3);
  }

  function formatCardInput(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
  }

  function formatExpiryInput(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }

  async function handleConfirmOrder() {
    setPaymentError('');
    if (totalItemCount === 0) {
      setPaymentError('Your basket is empty. Please select clothes in Step 02.');
      return;
    }
    if (!validateStep1()) {
      onStepChange(1);
      return;
    }

    if (paymentMethod === 'card') {
      const cleanNum = cardNumber.replace(/\s/g, '');
      if (!cardName.trim() || cleanNum.length < 13 || cardExpiry.length < 5 || cardCvc.length < 3) {
        setPaymentError('Please complete valid card details or choose PayNow / Pay on Pickup.');
        return;
      }
    }

    setSubmittingOrder(true);
    const randomCode = Math.floor(1000 + Math.random() * 9000);
    const orderCode = `HMW-${randomCode}`;
    const bookingDocId = `hmw-${Date.now()}-${randomCode}`;

    const itemsPayload = selectedItems.slice(0, 30).map((i) => ({
      id: i.id,
      name: i.name,
      qty: i.qty,
      unitPrice: i.price,
    }));

    const bookingPayload = {
      orderCode,
      userId: isLoyaltySignedIn && user ? user.uid : '',
      customerEmail: isLoyaltySignedIn && user?.email ? user.email : '',
      isGuest: !isLoyaltySignedIn,
      pickupDateIso: selectedDay.iso,
      pickupDayLabel: `${selectedDay.dayName}, ${selectedDay.dateLabel}`,
      pickupSlotId: selectedSlot.id,
      pickupWindow: selectedSlot.window,
      turnaround,
      fullName: customer.fullName.trim().slice(0, 120),
      phone: customer.phone.trim().slice(0, 25),
      address: customer.address.trim().slice(0, 240),
      postalCode: customer.postalCode.trim().slice(0, 12),
      notes: customer.notes.trim().slice(0, 300),
      items: itemsPayload,
      detergent,
      washTemp,
      finish,
      paymentMethod,
      paymentStatus: paymentMethod === 'card' ? 'paid' : 'pending',
      orderStatus: 'booked',
      subtotal,
      loyaltyDiscountRate,
      loyaltyDiscountAmount,
      deliveryFee,
      expressFee,
      total: grandTotal,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, 'bookings', bookingDocId), bookingPayload);
      if (isLoyaltySignedIn && user) {
        void updateOwnProfile({
          displayName: customer.fullName,
          phone: customer.phone,
          address: customer.address,
          postalCode: customer.postalCode,
        });
      }
      const order: ConfirmedOrder = {
        orderId: orderCode,
        createdAt: new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        pickupDayLabel: `${selectedDay.dayName}, ${selectedDay.dateLabel}`,
        pickupWindow: selectedSlot.window,
        turnaround,
        isGuest: !isLoyaltySignedIn,
        customerEmail: isLoyaltySignedIn && user?.email ? user.email : '',
        customer: { ...customer },
        items: itemsPayload,
        detergent,
        washTemp,
        finish,
        paymentMethod,
        subtotal,
        loyaltyDiscountRate,
        loyaltyDiscountAmount,
        deliveryFee,
        expressFee,
        total: grandTotal,
      };
      setConfirmedOrder(order);
    } catch (error) {
      setSubmittingOrder(false);
      handleFirestoreError(error, OperationType.CREATE, `bookings/${bookingDocId}`);
    } finally {
      setSubmittingOrder(false);
    }
  }

  function buildReceiptText(order: ConfirmedOrder): string {
    const lines = [
      `HelpMeWash Booking ${order.orderId}`,
      `Type: ${order.isGuest ? 'Guest Checkout' : `Loyalty Member (${siteConfig.loyaltyDiscountPercent}% Off)`}`,
      `Pickup: ${order.pickupDayLabel} (${order.pickupWindow})`,
      `Return: ${order.turnaround === 'express' ? 'Express Next-Day' : 'Standard 48-Hour'}`,
      `Customer: ${order.customer.fullName} · ${order.customer.phone}`,
      `Address: ${order.customer.address}, ${order.customer.postalCode}`,
      `Items:`,
      ...order.items.map(
        (i) => `- ${i.qty}x ${i.name} (${formatCurrency(i.qty * i.unitPrice)})`
      ),
      ...(order.loyaltyDiscountAmount > 0
        ? [`Loyalty Discount (${siteConfig.loyaltyDiscountPercent}%): -${formatCurrency(order.loyaltyDiscountAmount)}`]
        : []),
      `Care: ${order.detergent === 'signature' ? 'Signature Fresh' : 'Hypoallergenic'}, ${
        order.washTemp === 'cold' ? 'Cold Wash' : 'Warm Wash'
      }, ${order.finish === 'folded' ? 'Neatly Folded' : 'Tops on Hangers'}`,
      `Total: ${formatCurrency(order.total)} (${
        order.paymentMethod === 'paynow'
          ? 'PayNow QR'
          : order.paymentMethod === 'card'
            ? 'Card Payment'
            : 'Pay on Pickup'
      })`,
    ];
    return lines.join('\n');
  }

  function handleCopyReceipt() {
    if (!confirmedOrder) return;
    navigator.clipboard?.writeText(buildReceiptText(confirmedOrder));
    setCopiedReceipt(true);
    setTimeout(() => setCopiedReceipt(false), 2500);
  }

  function handleStartNewBooking() {
    setConfirmedOrder(null);
    setPaymentError('');
    setStep2Error('');
    onResetBooking();
    onStepChange(1);
  }

  const stepsMeta: { num: 1 | 2 | 3; code: string; title: string; subtitle: string }[] = [
    {
      num: 1,
      code: '01',
      title: 'Book Pickup Slot',
      subtitle: 'Date, 2-hr window & address',
    },
    {
      num: 2,
      code: '02',
      title: 'Select Clothes',
      subtitle: 'Wash, dry, fold & ironing',
    },
    {
      num: 3,
      code: '03',
      title: 'Easy Payment',
      subtitle: 'PayNow, card or on pickup',
    },
  ];

  // Confirmation Receipt State
  if (confirmedOrder) {
    const whatsappClean = siteConfig.whatsappNumber.replace(/\D/g, '');
    const whatsappHref = `https://wa.me/65${whatsappClean}?text=${encodeURIComponent(
      buildReceiptText(confirmedOrder)
    )}`;

    return (
      <section id="booking" className="py-12 sm:py-16">
        <div className="max-w-[920px] mx-auto px-4 sm:px-6">
          <div className="bg-white rounded-2xl border border-[#E2D9C5] shadow-sm overflow-hidden">
            <div className="bg-[#0E2742] text-white px-6 sm:px-8 py-6 border-b-4 border-[#EBBF4B] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-[#EBBF4B] text-[#0E2742] flex items-center justify-center shrink-0">
                  <Check className="w-6 h-6 stroke-[2.5]" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#EBBF4B]">
                    Booking Saved &amp; Confirmed
                  </p>
                  <h2 className="font-display text-2xl font-bold text-white">
                    Order <span className="font-mono">{confirmedOrder.orderId}</span>
                  </h2>
                </div>
              </div>
              <div className="text-sm text-white/85">
                <span className="block font-semibold text-white">
                  {confirmedOrder.pickupDayLabel}
                </span>
                <span className="tabular-nums">{confirmedOrder.pickupWindow}</span>
              </div>
            </div>

            <div className="p-6 sm:p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-[#EFE9DA]">
                <div className="space-y-1.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[#44596F]">
                    Pickup &amp; Return Details
                  </h3>
                  <p className="font-display font-bold text-[#0E2742]">
                    {confirmedOrder.customer.fullName}
                  </p>
                  <p className="text-sm text-[#44596F] tabular-nums">
                    {confirmedOrder.customer.phone}
                  </p>
                  <p className="text-sm text-[#0E2742]">
                    {confirmedOrder.customer.address}, {confirmedOrder.customer.postalCode}
                  </p>
                  {confirmedOrder.customer.notes && (
                    <p className="text-xs text-[#44596F] pt-1">
                      Note: {confirmedOrder.customer.notes}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[#44596F]">
                    Care &amp; Payment Summary
                  </h3>
                  <p className="text-sm text-[#0E2742]">
                    <span className="font-semibold">Booking Type:</span>{' '}
                    {confirmedOrder.isGuest
                      ? 'Guest Checkout'
                      : `Loyalty Member (${siteConfig.loyaltyDiscountPercent}% Off)`}
                  </p>
                  <p className="text-sm text-[#0E2742]">
                    <span className="font-semibold">Turnaround:</span>{' '}
                    {confirmedOrder.turnaround === 'express'
                      ? 'Express Next-Day Return'
                      : 'Standard 48-Hour Return'}
                  </p>
                  <p className="text-sm text-[#0E2742]">
                    <span className="font-semibold">Care:</span>{' '}
                    {confirmedOrder.detergent === 'signature'
                      ? 'Signature Fresh'
                      : 'Hypoallergenic'}{' '}
                    · {confirmedOrder.washTemp === 'cold' ? 'Cold Wash' : 'Warm Wash'} ·{' '}
                    {confirmedOrder.finish === 'folded' ? 'Neatly Folded' : 'Tops on Hangers'}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#44596F] mb-3">
                  Selected Clothes &amp; Services
                </h3>
                <div className="divide-y divide-[#EFE9DA] border border-[#EFE9DA] rounded-xl overflow-hidden">
                  {confirmedOrder.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between px-4 py-3 text-sm bg-[#FCFBF8]"
                    >
                      <span className="text-[#0E2742] font-medium">
                        <span className="font-mono font-semibold mr-2">{item.qty}×</span>
                        {item.name}
                      </span>
                      <span className="font-semibold text-[#0E2742] tabular-nums">
                        {formatCurrency(item.qty * item.unitPrice)}
                      </span>
                    </div>
                  ))}
                  {confirmedOrder.loyaltyDiscountAmount > 0 && (
                    <div className="flex items-center justify-between px-4 py-2.5 text-sm bg-[#FBF8F1] text-[#0E2742] font-semibold">
                      <span>Loyalty Member Discount ({siteConfig.loyaltyDiscountPercent}%)</span>
                      <span className="tabular-nums text-emerald-800">
                        -{formatCurrency(confirmedOrder.loyaltyDiscountAmount)}
                      </span>
                    </div>
                  )}
                  {confirmedOrder.expressFee > 0 && (
                    <div className="flex items-center justify-between px-4 py-2.5 text-sm bg-white text-[#44596F]">
                      <span>Express Next-Day Turnaround</span>
                      <span className="tabular-nums font-medium">
                        {formatCurrency(confirmedOrder.expressFee)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between px-4 py-2.5 text-sm bg-white text-[#44596F]">
                    <span>Doorstep Pickup &amp; Delivery</span>
                    <span className="tabular-nums font-medium">
                      {confirmedOrder.deliveryFee === 0
                        ? 'Free'
                        : formatCurrency(confirmedOrder.deliveryFee)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3.5 bg-[#0E2742] text-white font-display font-bold">
                    <span>Total Amount</span>
                    <span className="text-lg text-[#EBBF4B] tabular-nums">
                      {formatCurrency(confirmedOrder.total)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-3 min-h-[44px] bg-[#0E2742] hover:bg-[#173B63] text-white text-sm font-bold rounded-xl transition-colors whitespace-nowrap"
                  >
                    <MessageCircle className="w-4 h-4 text-[#EBBF4B]" aria-hidden="true" />
                    <span>Send to WhatsApp ({siteConfig.whatsappNumber})</span>
                  </a>

                  <button
                    type="button"
                    onClick={handleCopyReceipt}
                    className="inline-flex items-center gap-2 px-4 py-3 min-h-[44px] border border-[#D8CEB8] hover:bg-[#F7F3EA] text-[#0E2742] text-sm font-semibold rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {copiedReceipt ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-700" aria-hidden="true" />
                        <span>Receipt Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" aria-hidden="true" />
                        <span>Copy Summary</span>
                      </>
                    )}
                  </button>

                  {!confirmedOrder.isGuest && (
                    <button
                      type="button"
                      onClick={onOpenAccount}
                      className="px-4 py-3 min-h-[44px] bg-[#F7F3EA] hover:bg-[#EBBF4B] text-[#0E2742] text-sm font-bold rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                    >
                      View My Orders
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleStartNewBooking}
                  className="px-4 py-3 min-h-[44px] text-sm font-semibold text-[#44596F] hover:text-[#0E2742] underline underline-offset-4 cursor-pointer whitespace-nowrap"
                >
                  Book Another Pickup
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="booking" className="py-10 sm:py-14">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        {/* Section Heading + 3-Step Indicator Bar */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-6">
          <div className="space-y-1.5">
            <p className="text-xs font-bold uppercase tracking-wider text-[#44596F]">
              3-Step Online Booking
            </p>
            <h2
              className="font-display text-2xl sm:text-3xl font-extrabold text-[#0E2742] tracking-tight"
              style={{ textWrap: 'balance' }}
            >
              Schedule your pickup in 3 simple steps
            </h2>
          </div>

          {/* 3-Step Numbered Circles echoing the HelpMeWash poster */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 w-full lg:w-auto">
            {stepsMeta.map((step) => {
              const isCurrent = activeStep === step.num;
              const isDone = activeStep > step.num;
              return (
                <button
                  key={step.num}
                  type="button"
                  onClick={() => {
                    if (step.num === 1) onStepChange(1);
                    if (step.num === 2 && validateStep1()) onStepChange(2);
                    if (step.num === 3 && validateStep1() && totalItemCount > 0) onStepChange(3);
                  }}
                  className={`flex items-center gap-3 px-3 sm:px-4 py-2.5 rounded-xl border text-left transition-colors cursor-pointer min-h-[56px] ${
                    isCurrent
                      ? 'bg-[#0E2742] border-[#0E2742] text-white'
                      : isDone
                        ? 'bg-white border-[#EBBF4B] text-[#0E2742] hover:bg-[#FCFBF8]'
                        : 'bg-white/80 border-[#E2D9C5] text-[#44596F] hover:bg-white'
                  }`}
                >
                  <span
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-display font-extrabold text-xs shrink-0 ${
                      isCurrent
                        ? 'bg-[#EBBF4B] text-[#0E2742]'
                        : isDone
                          ? 'bg-[#EBBF4B] text-[#0E2742]'
                          : 'bg-[#EFE9DA] text-[#0E2742]'
                    }`}
                  >
                    {isDone ? <Check className="w-4 h-4 stroke-[2.5]" aria-hidden="true" /> : step.code}
                  </span>
                  <div className="min-w-0">
                    <span className="block font-display font-bold text-xs sm:text-sm truncate">
                      {step.title}
                    </span>
                    <span
                      className={`hidden sm:block text-[11px] truncate ${
                        isCurrent ? 'text-white/75' : 'text-[#44596F]'
                      }`}
                    >
                      {step.subtitle}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Loyalty / Guest Checkout Bar */}
        <div className="mb-5 bg-white rounded-xl border border-[#E2D9C5] px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {isLoyaltySignedIn && user ? (
            <>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-full bg-[#EBBF4B] text-[#0E2742] flex items-center justify-center shrink-0">
                  <Award className="w-4 h-4" aria-hidden="true" />
                </div>
                <div>
                  <span className="font-display font-bold text-[#0E2742]">
                    {siteConfig.loyaltyDiscountPercent}% Loyalty Member Discount Active
                  </span>
                  <span className="text-xs text-[#44596F] block sm:inline sm:ml-2">
                    Signed in as {user.email}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onOpenAccount}
                  className="text-xs font-bold text-[#0E2742] underline underline-offset-4 cursor-pointer"
                >
                  My Orders
                </button>
                <button
                  type="button"
                  onClick={() => void signOutUser()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[34px] rounded-lg border border-[#D8CEB8] hover:bg-[#F7F3EA] text-xs font-semibold text-[#0E2742] cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Sign Out</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-full bg-[#F7F3EA] text-[#0E2742] flex items-center justify-center shrink-0">
                  <Award className="w-4 h-4" aria-hidden="true" />
                </div>
                <div>
                  <span className="font-display font-bold text-[#0E2742]">
                    Guest Checkout Enabled
                  </span>
                  <span className="text-xs text-[#44596F] block sm:inline sm:ml-2">
                    Book right away, or sign in with Google for{' '}
                    <span className="font-bold text-[#0E2742]">
                      {siteConfig.loyaltyDiscountPercent}% off every order
                    </span>
                    .
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void signInWithGoogle()}
                className="px-4 py-2 min-h-[38px] bg-[#0E2742] hover:bg-[#173B63] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Sign in for {siteConfig.loyaltyDiscountPercent}% Off
              </button>
            </>
          )}
        </div>

        {/* Main 3-Step Workspace Card */}
        <div className="bg-white rounded-2xl border border-[#E2D9C5] shadow-sm p-5 sm:p-8">
          {/* STEP 1: BOOK PICKUP SLOT */}
          {activeStep === 1 && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-7 space-y-7">
                {/* Date Picker */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="w-4 h-4 text-[#0E2742]" aria-hidden="true" />
                    <h3 className="font-display font-bold text-base text-[#0E2742]">
                      1. Choose Pickup Date
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                    {days.map((day) => {
                      const active = day.iso === selectedDayIso;
                      return (
                        <button
                          key={day.iso}
                          type="button"
                          onClick={() => setSelectedDayIso(day.iso)}
                          className={`px-3 py-2.5 min-h-[60px] rounded-xl border text-center transition-colors cursor-pointer ${
                            active
                              ? 'bg-[#0E2742] border-[#0E2742] text-white'
                              : 'bg-[#FCFBF8] border-[#E2D9C5] text-[#0E2742] hover:border-[#0E2742]/50'
                          }`}
                        >
                          <span
                            className={`block text-[11px] font-semibold uppercase ${
                              active ? 'text-[#EBBF4B]' : 'text-[#44596F]'
                            }`}
                          >
                            {day.dayName}
                          </span>
                          <span className="block font-display font-bold text-sm mt-0.5 tabular-nums">
                            {day.dateLabel}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Time Window Picker */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="w-4 h-4 text-[#0E2742]" aria-hidden="true" />
                    <h3 className="font-display font-bold text-base text-[#0E2742]">
                      2. Choose 2-Hour Collection Window
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {TIME_SLOTS.map((slot) => {
                      const active = slot.id === selectedSlotId;
                      return (
                        <button
                          key={slot.id}
                          type="button"
                          onClick={() => setSelectedSlotId(slot.id)}
                          className={`flex items-center justify-between px-4 py-3.5 min-h-[58px] rounded-xl border text-left transition-colors cursor-pointer ${
                            active
                              ? 'bg-[#0E2742] border-[#0E2742] text-white'
                              : 'bg-[#FCFBF8] border-[#E2D9C5] text-[#0E2742] hover:border-[#0E2742]/50'
                          }`}
                        >
                          <div>
                            <span className="block font-display font-bold text-sm">
                              {slot.label}
                            </span>
                            <span
                              className={`block text-xs tabular-nums ${
                                active ? 'text-white/80' : 'text-[#44596F]'
                              }`}
                            >
                              {slot.window}
                            </span>
                          </div>
                          <span
                            className={`text-xs font-semibold ${
                              active ? 'text-[#EBBF4B]' : 'text-[#44596F]'
                            }`}
                          >
                            {slot.availability}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Turnaround Speed */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Truck className="w-4 h-4 text-[#0E2742]" aria-hidden="true" />
                    <h3 className="font-display font-bold text-base text-[#0E2742]">
                      3. Return Speed
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setTurnaround('standard')}
                      className={`px-4 py-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
                        turnaround === 'standard'
                          ? 'bg-[#0E2742] border-[#0E2742] text-white'
                          : 'bg-[#FCFBF8] border-[#E2D9C5] text-[#0E2742] hover:border-[#0E2742]/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-display font-bold text-sm">
                          Standard 48-Hour Return
                        </span>
                        <span
                          className={`text-xs font-bold ${
                            turnaround === 'standard' ? 'text-[#EBBF4B]' : 'text-[#0E2742]'
                          }`}
                        >
                          Included
                        </span>
                      </div>
                      <p
                        className={`text-xs mt-1 ${
                          turnaround === 'standard' ? 'text-white/75' : 'text-[#44596F]'
                        }`}
                      >
                        Same 2-hour delivery window two days after pickup.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTurnaround('express')}
                      className={`px-4 py-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
                        turnaround === 'express'
                          ? 'bg-[#0E2742] border-[#0E2742] text-white'
                          : 'bg-[#FCFBF8] border-[#E2D9C5] text-[#0E2742] hover:border-[#0E2742]/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-display font-bold text-sm">
                          Express Next-Day Return
                        </span>
                        <span
                          className={`text-xs font-bold tabular-nums ${
                            turnaround === 'express' ? 'text-[#EBBF4B]' : 'text-[#0E2742]'
                          }`}
                        >
                          +{formatCurrency(siteConfig.expressFee)}
                        </span>
                      </div>
                      <p
                        className={`text-xs mt-1 ${
                          turnaround === 'express' ? 'text-white/75' : 'text-[#44596F]'
                        }`}
                      >
                        Priority wash, dry &amp; fold delivered back the next evening.
                      </p>
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Pickup Address Form */}
              <div className="lg:col-span-5 bg-[#F7F3EA] rounded-2xl border border-[#E2D9C5] p-5 sm:p-6 flex flex-col justify-between gap-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-display font-bold text-lg text-[#0E2742]">
                      Pickup &amp; Delivery Address
                    </h3>
                    <p className="text-xs text-[#44596F] mt-0.5">
                      Our rider will WhatsApp you 15 minutes before arrival.
                    </p>
                  </div>

                  <div className="space-y-3.5">
                    <div>
                      <label
                        htmlFor="hmw-name"
                        className="block text-xs font-semibold text-[#0E2742] mb-1"
                      >
                        Full Name
                      </label>
                      <input
                        id="hmw-name"
                        type="text"
                        value={customer.fullName}
                        onChange={(e) => {
                          setCustomer({ ...customer, fullName: e.target.value });
                          if (step1Errors.fullName)
                            setStep1Errors({ ...step1Errors, fullName: undefined });
                        }}
                        placeholder="e.g. Sarah Tan"
                        className="w-full px-3.5 py-2.5 min-h-[42px] bg-white border border-[#D8CEB8] rounded-xl text-sm text-[#0E2742] focus:outline-none focus:ring-2 focus:ring-[#0E2742]"
                      />
                      {step1Errors.fullName && (
                        <p className="text-xs text-red-700 mt-1">{step1Errors.fullName}</p>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="hmw-phone"
                        className="block text-xs font-semibold text-[#0E2742] mb-1"
                      >
                        Mobile / WhatsApp Number
                      </label>
                      <input
                        id="hmw-phone"
                        type="tel"
                        value={customer.phone}
                        onChange={(e) => {
                          setCustomer({ ...customer, phone: e.target.value });
                          if (step1Errors.phone)
                            setStep1Errors({ ...step1Errors, phone: undefined });
                        }}
                        placeholder="e.g. 9123 4567"
                        className="w-full px-3.5 py-2.5 min-h-[42px] bg-white border border-[#D8CEB8] rounded-xl text-sm text-[#0E2742] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0E2742]"
                      />
                      {step1Errors.phone && (
                        <p className="text-xs text-red-700 mt-1">{step1Errors.phone}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <label
                          htmlFor="hmw-address"
                          className="block text-xs font-semibold text-[#0E2742] mb-1"
                        >
                          Block, Street &amp; Unit
                        </label>
                        <input
                          id="hmw-address"
                          type="text"
                          value={customer.address}
                          onChange={(e) => {
                            setCustomer({ ...customer, address: e.target.value });
                            if (step1Errors.address)
                              setStep1Errors({ ...step1Errors, address: undefined });
                          }}
                          placeholder="e.g. 128 River Valley Rd #08-14"
                          className="w-full px-3.5 py-2.5 min-h-[42px] bg-white border border-[#D8CEB8] rounded-xl text-sm text-[#0E2742] focus:outline-none focus:ring-2 focus:ring-[#0E2742]"
                        />
                        {step1Errors.address && (
                          <p className="text-xs text-red-700 mt-1">{step1Errors.address}</p>
                        )}
                      </div>

                      <div>
                        <label
                          htmlFor="hmw-postal"
                          className="block text-xs font-semibold text-[#0E2742] mb-1"
                        >
                          Postal Code
                        </label>
                        <input
                          id="hmw-postal"
                          type="text"
                          value={customer.postalCode}
                          onChange={(e) => {
                            setCustomer({ ...customer, postalCode: e.target.value });
                            if (step1Errors.postalCode)
                              setStep1Errors({ ...step1Errors, postalCode: undefined });
                          }}
                          placeholder="238294"
                          className="w-full px-3.5 py-2.5 min-h-[42px] bg-white border border-[#D8CEB8] rounded-xl text-sm text-[#0E2742] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0E2742]"
                        />
                        {step1Errors.postalCode && (
                          <p className="text-xs text-red-700 mt-1">{step1Errors.postalCode}</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="hmw-notes"
                        className="block text-xs font-semibold text-[#0E2742] mb-1"
                      >
                        Pickup Note <span className="font-normal text-[#44596F]">(Optional)</span>
                      </label>
                      <input
                        id="hmw-notes"
                        type="text"
                        value={customer.notes}
                        onChange={(e) => setCustomer({ ...customer, notes: e.target.value })}
                        placeholder="e.g. Leave at shoe rack or call lobby intercom"
                        className="w-full px-3.5 py-2.5 min-h-[42px] bg-white border border-[#D8CEB8] rounded-xl text-sm text-[#0E2742] focus:outline-none focus:ring-2 focus:ring-[#0E2742]"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3 pt-2 border-t border-[#E2D9C5]">
                  <div className="flex items-center justify-between text-xs text-[#44596F]">
                    <span>Selected Slot</span>
                    <span className="font-semibold text-[#0E2742] tabular-nums">
                      {selectedDay.dayName}, {selectedDay.dateLabel} · {selectedSlot.window}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleContinueFromStep1}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 min-h-[48px] bg-[#EBBF4B] hover:bg-[#DDA928] text-[#0E2742] font-display font-bold text-sm sm:text-base rounded-xl transition-colors cursor-pointer"
                  >
                    <span>Continue to Select Clothes</span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: SELECT CLOTHES & CARE */}
          {activeStep === 2 && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Catalog & Care Options */}
              <div className="lg:col-span-8 space-y-6">
                {/* Category Filter Tabs */}
                <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-[#F7F3EA] rounded-xl border border-[#E2D9C5]">
                  {CATEGORY_TABS.map((tab) => {
                    const active = categoryFilter === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setCategoryFilter(tab.id)}
                        className={`px-3.5 py-2 min-h-[40px] text-xs sm:text-sm font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                          active
                            ? 'bg-[#0E2742] text-white'
                            : 'text-[#44596F] hover:text-[#0E2742] hover:bg-white/70'
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                {/* Laundry Bags & Individual Garments List */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {filteredCatalog.map((item) => {
                    const qty = quantities[item.id] ?? 0;
                    return (
                      <div
                        key={item.id}
                        className={`p-4 rounded-xl border transition-colors flex flex-col justify-between gap-4 ${
                          qty > 0
                            ? 'bg-[#FCFBF8] border-[#0E2742]'
                            : 'bg-white border-[#E2D9C5] hover:border-[#0E2742]/40'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {item.imageUrl && (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              referrerPolicy="no-referrer"
                              className="w-16 h-16 rounded-lg object-cover border border-[#EFE9DA] shrink-0"
                            />
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[#44596F]">
                              <span className="truncate">{item.categoryLabel}</span>
                              <span aria-hidden="true">·</span>
                              <span className="truncate">{item.serviceType}</span>
                            </div>
                            <h4 className="font-display font-bold text-base text-[#0E2742] mt-1">
                              {item.name}
                            </h4>
                            <p className="text-xs text-[#44596F] leading-relaxed mt-1">
                              {item.description}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-[#EFE9DA]">
                          <div className="font-display font-extrabold text-[#0E2742] tabular-nums">
                            <span className="text-base">{formatCurrency(item.price)}</span>
                            <span className="text-xs font-medium text-[#44596F] ml-1">
                              {item.unit}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {qty > 0 ? (
                              <>
                                <button
                                  type="button"
                                  aria-label={`Remove one ${item.name}`}
                                  onClick={() => onUpdateQuantity(item.id, -1)}
                                  className="w-10 h-10 rounded-lg border border-[#D8CEB8] bg-white hover:bg-[#F7F3EA] text-[#0E2742] flex items-center justify-center transition-colors cursor-pointer"
                                >
                                  <Minus className="w-4 h-4" aria-hidden="true" />
                                </button>
                                <span className="w-8 text-center font-mono font-bold text-sm text-[#0E2742] tabular-nums">
                                  {qty}
                                </span>
                                <button
                                  type="button"
                                  aria-label={`Add one ${item.name}`}
                                  onClick={() => {
                                    setStep2Error('');
                                    onUpdateQuantity(item.id, 1);
                                  }}
                                  className="w-10 h-10 rounded-lg bg-[#0E2742] hover:bg-[#173B63] text-white flex items-center justify-center transition-colors cursor-pointer"
                                >
                                  <Plus className="w-4 h-4" aria-hidden="true" />
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setStep2Error('');
                                  onUpdateQuantity(item.id, 1);
                                }}
                                className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-lg bg-[#F7F3EA] hover:bg-[#EBBF4B] text-[#0E2742] text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
                              >
                                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>Add</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Wash, Dry & Fold Care Preferences */}
                <div className="bg-[#F7F3EA] rounded-xl border border-[#E2D9C5] p-4 sm:p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#0E2742]" aria-hidden="true" />
                    <h3 className="font-display font-bold text-sm sm:text-base text-[#0E2742]">
                      Wash &amp; Fold Preferences
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <span className="block text-xs font-semibold text-[#44596F] mb-1.5">
                        Detergent
                      </span>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setDetergent('signature')}
                          className={`px-2.5 py-2 min-h-[40px] rounded-lg text-xs font-semibold border cursor-pointer transition-colors ${
                            detergent === 'signature'
                              ? 'bg-[#0E2742] border-[#0E2742] text-white'
                              : 'bg-white border-[#D8CEB8] text-[#0E2742]'
                          }`}
                        >
                          Fresh Scent
                        </button>
                        <button
                          type="button"
                          onClick={() => setDetergent('hypoallergenic')}
                          className={`px-2.5 py-2 min-h-[40px] rounded-lg text-xs font-semibold border cursor-pointer transition-colors ${
                            detergent === 'hypoallergenic'
                              ? 'bg-[#0E2742] border-[#0E2742] text-white'
                              : 'bg-white border-[#D8CEB8] text-[#0E2742]'
                          }`}
                        >
                          Sensitive Free
                        </button>
                      </div>
                    </div>

                    <div>
                      <span className="block text-xs font-semibold text-[#44596F] mb-1.5">
                        Wash Temperature
                      </span>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setWashTemp('cold')}
                          className={`px-2.5 py-2 min-h-[40px] rounded-lg text-xs font-semibold border cursor-pointer transition-colors ${
                            washTemp === 'cold'
                              ? 'bg-[#0E2742] border-[#0E2742] text-white'
                              : 'bg-white border-[#D8CEB8] text-[#0E2742]'
                          }`}
                        >
                          Cold Safe
                        </button>
                        <button
                          type="button"
                          onClick={() => setWashTemp('warm')}
                          className={`px-2.5 py-2 min-h-[40px] rounded-lg text-xs font-semibold border cursor-pointer transition-colors ${
                            washTemp === 'warm'
                              ? 'bg-[#0E2742] border-[#0E2742] text-white'
                              : 'bg-white border-[#D8CEB8] text-[#0E2742]'
                          }`}
                        >
                          Warm 40°C
                        </button>
                      </div>
                    </div>

                    <div>
                      <span className="block text-xs font-semibold text-[#44596F] mb-1.5">
                        Finish Style
                      </span>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setFinish('folded')}
                          className={`px-2.5 py-2 min-h-[40px] rounded-lg text-xs font-semibold border cursor-pointer transition-colors ${
                            finish === 'folded'
                              ? 'bg-[#0E2742] border-[#0E2742] text-white'
                              : 'bg-white border-[#D8CEB8] text-[#0E2742]'
                          }`}
                        >
                          Neatly Folded
                        </button>
                        <button
                          type="button"
                          onClick={() => setFinish('hangers')}
                          className={`px-2.5 py-2 min-h-[40px] rounded-lg text-xs font-semibold border cursor-pointer transition-colors ${
                            finish === 'hangers'
                              ? 'bg-[#0E2742] border-[#0E2742] text-white'
                              : 'bg-white border-[#D8CEB8] text-[#0E2742]'
                          }`}
                        >
                          With Hangers
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Sticky Order Summary */}
              <aside className="lg:col-span-4 lg:sticky lg:top-24 bg-[#F7F3EA] rounded-2xl border border-[#E2D9C5] p-5 sm:p-6 space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-[#E2D9C5]">
                  <div>
                    <h3 className="font-display font-bold text-base text-[#0E2742]">
                      Your Laundry Basket
                    </h3>
                    <p className="text-xs text-[#44596F] tabular-nums">
                      {selectedDay.dayName}, {selectedDay.dateLabel} · {selectedSlot.window}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onStepChange(1)}
                    className="text-xs font-semibold text-[#0E2742] underline underline-offset-4 cursor-pointer whitespace-nowrap"
                  >
                    Edit Slot
                  </button>
                </div>

                {selectedItems.length === 0 ? (
                  <div className="py-6 text-center space-y-3">
                    <ShoppingBag className="w-8 h-8 text-[#44596F] mx-auto" aria-hidden="true" />
                    <p className="text-sm text-[#44596F]">
                      Select your Wash · Dry · Fold bag or individual garments on the left.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setStep2Error('');
                        onUpdateQuantity('wdf-6kg', 1);
                      }}
                      className="px-4 py-2.5 min-h-[40px] bg-white border border-[#D8CEB8] hover:border-[#0E2742] text-xs font-bold text-[#0E2742] rounded-lg transition-colors cursor-pointer"
                    >
                      + Quick Add 6kg Wash · Dry · Fold ($30)
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
                    {selectedItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-[#0E2742] truncate">{item.name}</p>
                          <p className="text-xs text-[#44596F] tabular-nums">
                            {item.qty} × {formatCurrency(item.price)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-bold text-[#0E2742] tabular-nums">
                            {formatCurrency(item.lineTotal)}
                          </span>
                          <button
                            type="button"
                            aria-label={`Decrease ${item.name}`}
                            onClick={() => onUpdateQuantity(item.id, -1)}
                            className="w-7 h-7 rounded-md bg-white border border-[#D8CEB8] text-[#0E2742] flex items-center justify-center hover:bg-[#EFE9DA] cursor-pointer"
                          >
                            <Minus className="w-3 h-3" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-2 pt-3 border-t border-[#E2D9C5] text-sm">
                  <div className="flex items-center justify-between text-[#44596F]">
                    <span>Items Subtotal</span>
                    <span className="font-semibold text-[#0E2742] tabular-nums">
                      {formatCurrency(subtotal)}
                    </span>
                  </div>
                  {loyaltyDiscountAmount > 0 && (
                    <div className="flex items-center justify-between text-emerald-800 font-semibold">
                      <span>Loyalty ({siteConfig.loyaltyDiscountPercent}% Off)</span>
                      <span className="tabular-nums">-{formatCurrency(loyaltyDiscountAmount)}</span>
                    </div>
                  )}
                  {expressFee > 0 && (
                    <div className="flex items-center justify-between text-[#44596F]">
                      <span>Express Next-Day</span>
                      <span className="font-semibold text-[#0E2742] tabular-nums">
                        {formatCurrency(expressFee)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-[#44596F]">
                    <span>Doorstep Pickup &amp; Return</span>
                    <span className="font-semibold text-[#0E2742] tabular-nums">
                      {subtotal === 0
                        ? '$0.00'
                        : deliveryFee === 0
                          ? `Free ($${siteConfig.freeDeliveryThreshold}+ order)`
                          : formatCurrency(deliveryFee)}
                    </span>
                  </div>
                  {subtotal > 0 && subtotal < siteConfig.freeDeliveryThreshold && (
                    <p className="text-xs text-[#44596F] bg-white px-3 py-2 rounded-lg border border-[#E2D9C5]">
                      Add{' '}
                      <span className="font-bold text-[#0E2742] tabular-nums">
                        {formatCurrency(siteConfig.freeDeliveryThreshold - subtotal)}
                      </span>{' '}
                      more for free pickup &amp; delivery.
                    </p>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t border-[#E2D9C5] font-display font-extrabold text-base text-[#0E2742]">
                    <span>Estimated Total</span>
                    <span className="text-xl tabular-nums">{formatCurrency(grandTotal)}</span>
                  </div>
                </div>

                {step2Error && (
                  <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{step2Error}</span>
                  </div>
                )}

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => onStepChange(1)}
                    className="px-4 py-3.5 min-h-[48px] rounded-xl border border-[#D8CEB8] bg-white hover:bg-[#EFE9DA] text-[#0E2742] text-sm font-bold transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" aria-label="Back to Step 1" />
                  </button>
                  <button
                    type="button"
                    onClick={handleContinueFromStep2}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3.5 min-h-[48px] bg-[#EBBF4B] hover:bg-[#DDA928] text-[#0E2742] font-display font-bold text-sm rounded-xl transition-colors cursor-pointer"
                  >
                    <span>Continue to Payment</span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </aside>
            </div>
          )}

          {/* STEP 3: EASY PAYMENT & CONFIRMATION */}
          {activeStep === 3 && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Payment Methods */}
              <div className="lg:col-span-7 space-y-6">
                <div>
                  <h3 className="font-display font-bold text-lg text-[#0E2742]">
                    Choose Easy Payment Method
                  </h3>
                  <p className="text-sm text-[#44596F] mt-0.5">
                    Transparent pricing with zero hidden fees. Pay securely now or upon collection.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod('paynow');
                      setPaymentError('');
                    }}
                    className={`p-4 rounded-xl border text-left transition-colors cursor-pointer ${
                      paymentMethod === 'paynow'
                        ? 'bg-[#0E2742] border-[#0E2742] text-white'
                        : 'bg-[#FCFBF8] border-[#E2D9C5] text-[#0E2742] hover:border-[#0E2742]/50'
                    }`}
                  >
                    <QrCode
                      className={`w-5 h-5 mb-2 ${
                        paymentMethod === 'paynow' ? 'text-[#EBBF4B]' : 'text-[#0E2742]'
                      }`}
                      aria-hidden="true"
                    />
                    <span className="block font-display font-bold text-sm">PayNow QR</span>
                    <span
                      className={`block text-xs mt-0.5 ${
                        paymentMethod === 'paynow' ? 'text-white/75' : 'text-[#44596F]'
                      }`}
                    >
                      Instant bank scan
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod('card');
                      setPaymentError('');
                    }}
                    className={`p-4 rounded-xl border text-left transition-colors cursor-pointer ${
                      paymentMethod === 'card'
                        ? 'bg-[#0E2742] border-[#0E2742] text-white'
                        : 'bg-[#FCFBF8] border-[#E2D9C5] text-[#0E2742] hover:border-[#0E2742]/50'
                    }`}
                  >
                    <CreditCard
                      className={`w-5 h-5 mb-2 ${
                        paymentMethod === 'card' ? 'text-[#EBBF4B]' : 'text-[#0E2742]'
                      }`}
                      aria-hidden="true"
                    />
                    <span className="block font-display font-bold text-sm">Card Payment</span>
                    <span
                      className={`block text-xs mt-0.5 ${
                        paymentMethod === 'card' ? 'text-white/75' : 'text-[#44596F]'
                      }`}
                    >
                      Visa, Mastercard, Amex
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod('cash_on_pickup');
                      setPaymentError('');
                    }}
                    className={`p-4 rounded-xl border text-left transition-colors cursor-pointer ${
                      paymentMethod === 'cash_on_pickup'
                        ? 'bg-[#0E2742] border-[#0E2742] text-white'
                        : 'bg-[#FCFBF8] border-[#E2D9C5] text-[#0E2742] hover:border-[#0E2742]/50'
                    }`}
                  >
                    <Banknote
                      className={`w-5 h-5 mb-2 ${
                        paymentMethod === 'cash_on_pickup' ? 'text-[#EBBF4B]' : 'text-[#0E2742]'
                      }`}
                      aria-hidden="true"
                    />
                    <span className="block font-display font-bold text-sm">Pay on Pickup</span>
                    <span
                      className={`block text-xs mt-0.5 ${
                        paymentMethod === 'cash_on_pickup' ? 'text-white/75' : 'text-[#44596F]'
                      }`}
                    >
                      Cash or PayNow to rider
                    </span>
                  </button>
                </div>

                {/* Method-specific panel */}
                {paymentMethod === 'paynow' && (
                  <div className="bg-[#F7F3EA] rounded-2xl border border-[#E2D9C5] p-5 sm:p-6 flex flex-col sm:flex-row items-center gap-6">
                    <div className="w-36 h-36 bg-white p-3 rounded-xl border border-[#D8CEB8] shrink-0 flex items-center justify-center">
                      <svg
                        viewBox="0 0 100 100"
                        className="w-full h-full text-[#0E2742]"
                        role="img"
                        aria-label="PayNow QR code for HelpMeWash"
                      >
                        <rect x="6" y="6" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="6" />
                        <rect x="14" y="14" width="10" height="10" fill="currentColor" />
                        <rect x="68" y="6" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="6" />
                        <rect x="76" y="14" width="10" height="10" fill="currentColor" />
                        <rect x="6" y="68" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="6" />
                        <rect x="14" y="76" width="10" height="10" fill="currentColor" />
                        <rect x="42" y="8" width="8" height="8" fill="currentColor" />
                        <rect x="52" y="16" width="8" height="8" fill="currentColor" />
                        <rect x="40" y="28" width="12" height="8" fill="currentColor" />
                        <rect x="8" y="42" width="10" height="8" fill="currentColor" />
                        <rect x="24" y="42" width="10" height="14" fill="currentColor" />
                        <rect x="42" y="42" width="16" height="16" fill="#EBBF4B" />
                        <rect x="64" y="42" width="10" height="10" fill="currentColor" />
                        <rect x="80" y="42" width="14" height="8" fill="currentColor" />
                        <rect x="42" y="66" width="8" height="10" fill="currentColor" />
                        <rect x="56" y="64" width="12" height="12" fill="currentColor" />
                        <rect x="74" y="64" width="20" height="8" fill="currentColor" />
                        <rect x="42" y="82" width="14" height="12" fill="currentColor" />
                        <rect x="64" y="82" width="10" height="12" fill="currentColor" />
                        <rect x="80" y="78" width="14" height="16" fill="currentColor" />
                      </svg>
                    </div>
                    <div className="space-y-2 text-center sm:text-left">
                      <p className="font-display font-bold text-base text-[#0E2742]">
                        Scan with any Singapore Banking App
                      </p>
                      <p className="text-sm text-[#44596F]">
                        PayNow UEN: <span className="font-mono font-semibold text-[#0E2742]">202408825W</span>{' '}
                        (HelpMeWash Pte Ltd)
                      </p>
                      <p className="text-sm text-[#0E2742]">
                        Exact Payable:{' '}
                        <span className="font-display font-extrabold text-lg tabular-nums">
                          {formatCurrency(grandTotal)}
                        </span>
                      </p>
                      <p className="text-xs text-[#44596F]">
                        Click &ldquo;Confirm &amp; Book Pickup&rdquo; once you complete the scan.
                      </p>
                    </div>
                  </div>
                )}

                {paymentMethod === 'card' && (
                  <div className="bg-[#F7F3EA] rounded-2xl border border-[#E2D9C5] p-5 sm:p-6 space-y-4">
                    <div>
                      <label
                        htmlFor="hmw-card-name"
                        className="block text-xs font-semibold text-[#0E2742] mb-1"
                      >
                        Name on Card
                      </label>
                      <input
                        id="hmw-card-name"
                        type="text"
                        value={cardName}
                        onChange={(e) => setCardName(e.target.value)}
                        placeholder="SARAH TAN"
                        className="w-full px-3.5 py-2.5 min-h-[42px] bg-white border border-[#D8CEB8] rounded-xl text-sm text-[#0E2742] focus:outline-none focus:ring-2 focus:ring-[#0E2742]"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="hmw-card-num"
                        className="block text-xs font-semibold text-[#0E2742] mb-1"
                      >
                        Card Number
                      </label>
                      <input
                        id="hmw-card-num"
                        type="text"
                        inputMode="numeric"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(formatCardInput(e.target.value))}
                        placeholder="4242 4242 4242 4242"
                        className="w-full px-3.5 py-2.5 min-h-[42px] bg-white border border-[#D8CEB8] rounded-xl text-sm font-mono text-[#0E2742] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0E2742]"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="hmw-card-exp"
                          className="block text-xs font-semibold text-[#0E2742] mb-1"
                        >
                          Expiry (MM/YY)
                        </label>
                        <input
                          id="hmw-card-exp"
                          type="text"
                          inputMode="numeric"
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(formatExpiryInput(e.target.value))}
                          placeholder="08/29"
                          className="w-full px-3.5 py-2.5 min-h-[42px] bg-white border border-[#D8CEB8] rounded-xl text-sm font-mono text-[#0E2742] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0E2742]"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="hmw-card-cvc"
                          className="block text-xs font-semibold text-[#0E2742] mb-1"
                        >
                          CVC
                        </label>
                        <input
                          id="hmw-card-cvc"
                          type="password"
                          inputMode="numeric"
                          maxLength={4}
                          value={cardCvc}
                          onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                          placeholder="123"
                          className="w-full px-3.5 py-2.5 min-h-[42px] bg-white border border-[#D8CEB8] rounded-xl text-sm font-mono text-[#0E2742] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0E2742]"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {paymentMethod === 'cash_on_pickup' && (
                  <div className="bg-[#F7F3EA] rounded-2xl border border-[#E2D9C5] p-5 sm:p-6 space-y-2">
                    <p className="font-display font-bold text-base text-[#0E2742]">
                      Zero Upfront Charge
                    </p>
                    <p className="text-sm text-[#44596F] leading-relaxed">
                      Reserve your collection slot right now and pay{' '}
                      <span className="font-bold text-[#0E2742] tabular-nums">
                        {formatCurrency(grandTotal)}
                      </span>{' '}
                      in cash or via PayNow when our rider collects your laundry bag at your doorstep.
                    </p>
                  </div>
                )}

                {paymentError && (
                  <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{paymentError}</span>
                  </div>
                )}
              </div>

              {/* Right Final Review Box */}
              <div className="lg:col-span-5 bg-[#F7F3EA] rounded-2xl border border-[#E2D9C5] p-5 sm:p-6 space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-[#E2D9C5]">
                  <h3 className="font-display font-bold text-base text-[#0E2742]">
                    Final Order Review
                  </h3>
                  <button
                    type="button"
                    onClick={() => onStepChange(2)}
                    className="text-xs font-semibold text-[#0E2742] underline underline-offset-4 cursor-pointer"
                  >
                    Edit Clothes
                  </button>
                </div>

                <div className="text-xs space-y-1.5 text-[#44596F] pb-3 border-b border-[#E2D9C5]">
                  <p>
                    <span className="font-semibold text-[#0E2742]">Pickup:</span>{' '}
                    {selectedDay.dayName}, {selectedDay.dateLabel} ({selectedSlot.window})
                  </p>
                  <p>
                    <span className="font-semibold text-[#0E2742]">Address:</span>{' '}
                    {customer.address}, {customer.postalCode}
                  </p>
                  <p>
                    <span className="font-semibold text-[#0E2742]">Checkout:</span>{' '}
                    {isLoyaltySignedIn
                      ? `Loyalty Member (${siteConfig.loyaltyDiscountPercent}% Off)`
                      : 'Guest Checkout'}
                  </p>
                </div>

                <div className="space-y-2 text-sm">
                  {selectedItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between">
                      <span className="text-[#0E2742]">
                        <span className="font-mono font-semibold mr-1.5">{item.qty}×</span>
                        {item.name}
                      </span>
                      <span className="font-semibold text-[#0E2742] tabular-nums">
                        {formatCurrency(item.lineTotal)}
                      </span>
                    </div>
                  ))}
                  {loyaltyDiscountAmount > 0 && (
                    <div className="flex items-center justify-between text-emerald-800 font-semibold">
                      <span>Loyalty Discount ({siteConfig.loyaltyDiscountPercent}%)</span>
                      <span className="tabular-nums">-{formatCurrency(loyaltyDiscountAmount)}</span>
                    </div>
                  )}
                  {expressFee > 0 && (
                    <div className="flex items-center justify-between text-[#44596F]">
                      <span>Express Next-Day Return</span>
                      <span className="tabular-nums">{formatCurrency(expressFee)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-[#44596F]">
                    <span>Doorstep Pickup &amp; Delivery</span>
                    <span className="tabular-nums">
                      {deliveryFee === 0 ? 'Free' : formatCurrency(deliveryFee)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-[#E2D9C5] font-display font-extrabold text-[#0E2742]">
                  <span>Total Due</span>
                  <span className="text-2xl tabular-nums">{formatCurrency(grandTotal)}</span>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => onStepChange(2)}
                    className="px-4 py-3.5 min-h-[48px] rounded-xl border border-[#D8CEB8] bg-white hover:bg-[#EFE9DA] text-[#0E2742] text-sm font-bold transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" aria-label="Back to Step 2" />
                  </button>
                  <button
                    type="button"
                    disabled={submittingOrder}
                    onClick={() => void handleConfirmOrder()}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3.5 min-h-[48px] bg-[#EBBF4B] hover:bg-[#DDA928] text-[#0E2742] font-display font-bold text-sm sm:text-base rounded-xl transition-colors cursor-pointer disabled:opacity-60"
                  >
                    <Check className="w-4 h-4 stroke-[2.5]" aria-hidden="true" />
                    <span>
                      {submittingOrder ? 'Saving Booking...' : 'Confirm & Book Pickup'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
