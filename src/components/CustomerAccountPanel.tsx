import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  Award,
  ArrowLeft,
  Calendar,
  Check,
  LogOut,
  MessageCircle,
  Package,
  Save,
  XCircle,
} from 'lucide-react';
import { useFirebase } from '../contexts/FirebaseContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { formatCurrency } from '../data/laundryCatalog';

interface CustomerOrder {
  id: string;
  orderCode: string;
  pickupDayLabel: string;
  pickupWindow: string;
  turnaround: string;
  orderStatus: string;
  paymentMethod: string;
  paymentStatus: string;
  items: { id: string; name: string; qty: number; unitPrice: number }[];
  subtotal: number;
  loyaltyDiscountAmount: number;
  total: number;
}

interface CustomerAccountPanelProps {
  onBackToStore: () => void;
  onStartBooking: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  booked: 'Booked',
  picked_up: 'Picked Up',
  washing: 'Washing',
  folding_ironing: 'Folding & Ironing',
  out_for_delivery: 'Out for Delivery',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export function CustomerAccountPanel({
  onBackToStore,
  onStartBooking,
}: CustomerAccountPanelProps) {
  const {
    user,
    userProfile,
    authReady,
    siteConfig,
    signInWithGoogle,
    signOutUser,
    updateOwnProfile,
  } = useFirebase();
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Saved delivery details form
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editPostal, setEditPostal] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSavedToast, setProfileSavedToast] = useState(false);

  useEffect(() => {
    if (!userProfile) return;
    setEditName(userProfile.displayName || '');
    setEditPhone(userProfile.phone || '');
    setEditAddress(userProfile.address || '');
    setEditPostal(userProfile.postalCode || '');
  }, [userProfile]);

  useEffect(() => {
    if (!authReady || !user) {
      setOrders([]);
      return;
    }

    setLoadingOrders(true);
    const q = query(
      collection(db, 'bookings'),
      where('userId', '==', user.uid),
      where('isGuest', '==', false),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const rows: CustomerOrder[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            orderCode: String(data.orderCode ?? ''),
            pickupDayLabel: String(data.pickupDayLabel ?? ''),
            pickupWindow: String(data.pickupWindow ?? ''),
            turnaround: String(data.turnaround ?? 'standard'),
            orderStatus: String(data.orderStatus ?? 'booked'),
            paymentMethod: String(data.paymentMethod ?? 'paynow'),
            paymentStatus: String(data.paymentStatus ?? 'pending'),
            items: Array.isArray(data.items) ? data.items : [],
            subtotal: Number(data.subtotal ?? 0),
            loyaltyDiscountAmount: Number(data.loyaltyDiscountAmount ?? 0),
            total: Number(data.total ?? 0),
          };
        });
        setOrders(rows);
        setLoadingOrders(false);
      },
      (error) => {
        setLoadingOrders(false);
        handleFirestoreError(error, OperationType.LIST, 'bookings');
      }
    );

    return () => unsub();
  }, [authReady, user]);

  const totalSaved = useMemo(
    () =>
      orders
        .filter((o) => o.orderStatus !== 'cancelled')
        .reduce((sum, o) => sum + o.loyaltyDiscountAmount, 0),
    [orders]
  );

  async function handleSaveProfile() {
    setSavingProfile(true);
    try {
      await updateOwnProfile({
        displayName: editName,
        phone: editPhone,
        address: editAddress,
        postalCode: editPostal,
      });
      setProfileSavedToast(true);
      setTimeout(() => setProfileSavedToast(false), 2500);
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleCancelOrder(orderId: string) {
    setCancellingId(orderId);
    try {
      await updateDoc(doc(db, 'bookings', orderId), {
        orderStatus: 'cancelled',
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `bookings/${orderId}`);
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <section className="py-10 sm:py-14 bg-[#F7F3EA] min-h-[75vh]">
      <div className="max-w-[1000px] mx-auto px-4 sm:px-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBackToStore}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#0E2742] hover:underline cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Back to Booking</span>
          </button>

          {user && (
            <button
              type="button"
              onClick={() => void signOutUser()}
              className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] rounded-xl border border-[#D8CEB8] bg-white hover:bg-[#EFE9DA] text-xs font-bold text-[#0E2742] cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Sign Out</span>
            </button>
          )}
        </div>

        {!user ? (
          <div className="bg-white rounded-2xl border border-[#E2D9C5] p-8 text-center space-y-5">
            <div className="w-14 h-14 rounded-full bg-[#EBBF4B] text-[#0E2742] flex items-center justify-center mx-auto">
              <Award className="w-7 h-7" aria-hidden="true" />
            </div>
            <div className="space-y-2 max-w-md mx-auto">
              <h1 className="font-display font-extrabold text-2xl text-[#0E2742]">
                HelpMeWash Loyalty Program
              </h1>
              <p className="text-sm text-[#44596F] leading-relaxed">
                Sign in with Google to enjoy{' '}
                <span className="font-bold text-[#0E2742]">
                  {siteConfig.loyaltyDiscountPercent}% off every booking
                </span>{' '}
                and track all your past and upcoming laundry pickups. Guest checkout always
                remains open if you prefer to book without signing in.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void signInWithGoogle()}
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 min-h-[48px] bg-[#0E2742] hover:bg-[#173B63] text-white font-display font-bold text-sm rounded-xl transition-colors cursor-pointer"
            >
              <span>Sign in with Google ({siteConfig.loyaltyDiscountPercent}% Off)</span>
            </button>
          </div>
        ) : (
          <>
            {/* Loyalty Header Card */}
            <div className="bg-[#0E2742] text-white rounded-2xl p-6 sm:p-7 border-b-4 border-[#EBBF4B] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-wider text-[#EBBF4B]">
                  {userProfile?.loyaltyTier === 'vip' ? 'VIP Loyalty Member' : 'Loyalty Member'} ·{' '}
                  {siteConfig.loyaltyDiscountPercent}% Off Every Order
                </p>
                <h1 className="font-display font-extrabold text-2xl text-white">
                  {userProfile?.displayName || user.displayName || user.email}
                </h1>
                <p className="text-xs text-white/75">{user.email}</p>
              </div>

              <div className="flex items-center gap-6">
                <div>
                  <span className="block text-xs text-white/70">Total Orders</span>
                  <span className="font-display font-extrabold text-2xl tabular-nums">
                    {orders.length}
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-white/70">Loyalty Saved</span>
                  <span className="font-display font-extrabold text-2xl text-[#EBBF4B] tabular-nums">
                    {formatCurrency(totalSaved)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onStartBooking}
                  className="px-4 py-2.5 min-h-[42px] bg-[#EBBF4B] hover:bg-[#DDA928] text-[#0E2742] font-display font-bold text-xs sm:text-sm rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                >
                  New Booking
                </button>
              </div>
            </div>

            {/* Saved Contact & Pickup Details */}
            <div className="bg-white rounded-2xl border border-[#E2D9C5] p-5 sm:p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-display font-bold text-base text-[#0E2742]">
                    Saved Contact &amp; Pickup Details
                  </h2>
                  <p className="text-xs text-[#44596F]">
                    Used to pre-fill Step 01 whenever you book a pickup.
                  </p>
                </div>
                {profileSavedToast && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800">
                    <Check className="w-3.5 h-3.5" aria-hidden="true" />
                    Saved
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#0E2742] mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 min-h-[40px] border border-[#D8CEB8] rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0E2742] mb-1">
                    Mobile / WhatsApp
                  </label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="9123 4567"
                    className="w-full px-3 py-2 min-h-[40px] border border-[#D8CEB8] rounded-xl text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0E2742] mb-1">
                    Pickup Address
                  </label>
                  <input
                    type="text"
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    placeholder="Street & unit number"
                    className="w-full px-3 py-2 min-h-[40px] border border-[#D8CEB8] rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0E2742] mb-1">
                    Postal Code
                  </label>
                  <input
                    type="text"
                    value={editPostal}
                    onChange={(e) => setEditPostal(e.target.value)}
                    placeholder="238294"
                    className="w-full px-3 py-2 min-h-[40px] border border-[#D8CEB8] rounded-xl text-sm tabular-nums"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={savingProfile}
                  onClick={() => void handleSaveProfile()}
                  className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] bg-[#0E2742] hover:bg-[#173B63] text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-60"
                >
                  <Save className="w-3.5 h-3.5 text-[#EBBF4B]" aria-hidden="true" />
                  <span>{savingProfile ? 'Saving...' : 'Save Details'}</span>
                </button>
              </div>
            </div>

            {/* Orders List */}
            <div className="space-y-4">
              <h2 className="font-display font-bold text-lg text-[#0E2742]">
                Your Laundry Bookings
              </h2>

              {loadingOrders ? (
                <div className="bg-white rounded-2xl border border-[#E2D9C5] p-8 text-center text-sm text-[#44596F]">
                  Loading your bookings...
                </div>
              ) : orders.length === 0 ? (
                <div className="bg-white rounded-2xl border border-[#E2D9C5] p-8 text-center space-y-3">
                  <Package className="w-8 h-8 text-[#44596F] mx-auto" aria-hidden="true" />
                  <p className="text-sm text-[#44596F]">
                    You haven&apos;t placed a member booking yet. Your{' '}
                    {siteConfig.loyaltyDiscountPercent}% loyalty discount applies automatically on
                    your next order.
                  </p>
                  <button
                    type="button"
                    onClick={onStartBooking}
                    className="px-5 py-2.5 min-h-[42px] bg-[#EBBF4B] hover:bg-[#DDA928] text-[#0E2742] font-display font-bold text-sm rounded-xl transition-colors cursor-pointer"
                  >
                    Book Your First Pickup
                  </button>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {orders.map((order) => (
                    <div
                      key={order.id}
                      className="bg-white rounded-2xl border border-[#E2D9C5] p-5 space-y-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#EFE9DA]">
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-base text-[#0E2742]">
                            {order.orderCode}
                          </span>
                          <span aria-hidden="true" className="text-[#D8CEB8]">
                            ·
                          </span>
                          <span className="text-sm font-semibold text-[#0E2742]">
                            {STATUS_LABELS[order.orderStatus] ?? order.orderStatus}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-[#44596F]">
                          <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>
                            {order.pickupDayLabel} · {order.pickupWindow}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm">
                        <div className="space-y-1">
                          <p className="text-[#0E2742] font-medium">
                            {order.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}
                          </p>
                          <p className="text-xs text-[#44596F]">
                            Payment:{' '}
                            {order.paymentMethod === 'paynow'
                              ? 'PayNow QR'
                              : order.paymentMethod === 'card'
                                ? 'Card'
                                : 'Pay on Pickup'}{' '}
                            ({order.paymentStatus === 'paid' ? 'Paid' : 'Pending'})
                            {order.loyaltyDiscountAmount > 0 &&
                              ` · Saved ${formatCurrency(order.loyaltyDiscountAmount)}`}
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="font-display font-extrabold text-lg text-[#0E2742] tabular-nums">
                            {formatCurrency(order.total)}
                          </span>

                          {order.orderStatus === 'booked' && (
                            <button
                              type="button"
                              disabled={cancellingId === order.id}
                              onClick={() => void handleCancelOrder(order.id)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 min-h-[36px] rounded-lg border border-red-200 text-red-700 hover:bg-red-50 text-xs font-semibold cursor-pointer disabled:opacity-50"
                            >
                              <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>
                                {cancellingId === order.id ? 'Cancelling...' : 'Cancel'}
                              </span>
                            </button>
                          )}

                          <a
                            href={`https://wa.me/65${siteConfig.whatsappNumber.replace(/\D/g, '')}?text=${encodeURIComponent(
                              `Hi HelpMeWash, checking on my order ${order.orderCode}`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1.5 min-h-[36px] rounded-lg bg-[#F7F3EA] hover:bg-[#EBBF4B] text-[#0E2742] text-xs font-bold transition-colors"
                          >
                            <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Help</span>
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
