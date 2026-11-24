import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  ArrowLeft,
  Check,
  Database,
  Download,
  Image as ImageIcon,
  LogOut,
  MessageCircle,
  Plus,
  Search,
  Settings,
  Shield,
  ShoppingBag,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import {
  DEFAULT_SITE_CONFIG,
  useFirebase,
  type ServiceRecord,
  type SiteConfigData,
} from '../contexts/FirebaseContext';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  compressImageToDataUrl,
  db,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase';
import { formatCurrency, type ServiceCategory } from '../data/laundryCatalog';

interface AdminBookingRow {
  id: string;
  orderCode: string;
  userId: string;
  customerEmail: string;
  isGuest: boolean;
  pickupDateIso: string;
  pickupDayLabel: string;
  pickupSlotId: string;
  pickupWindow: string;
  turnaround: 'standard' | 'express';
  fullName: string;
  phone: string;
  address: string;
  postalCode: string;
  notes: string;
  items: { id: string; name: string; qty: number; unitPrice: number }[];
  detergent: string;
  washTemp: string;
  finish: string;
  paymentMethod: string;
  paymentStatus: 'pending' | 'paid';
  orderStatus:
    | 'booked'
    | 'picked_up'
    | 'washing'
    | 'folding_ironing'
    | 'out_for_delivery'
    | 'completed'
    | 'cancelled';
  subtotal: number;
  loyaltyDiscountRate: number;
  loyaltyDiscountAmount: number;
  deliveryFee: number;
  expressFee: number;
  total: number;
}

interface AdminRecord {
  uid: string;
  email: string;
  displayName: string;
}

interface AdminCustomerRow {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  phone: string;
  address: string;
  postalCode: string;
  adminNotes: string;
  loyaltyTier: 'member' | 'vip';
  joinedAtLabel: string;
}

interface AdminDashboardProps {
  onBackToStore: () => void;
}

type AdminTab = 'orders' | 'customers' | 'services' | 'images' | 'access';

const ORDER_STATUSES: { value: AdminBookingRow['orderStatus']; label: string }[] = [
  { value: 'booked', label: 'Booked' },
  { value: 'picked_up', label: 'Picked Up' },
  { value: 'washing', label: 'Washing' },
  { value: 'folding_ironing', label: 'Folding & Ironing' },
  { value: 'out_for_delivery', label: 'Out for Delivery' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const CATEGORY_OPTIONS: { value: ServiceCategory; label: string }[] = [
  { value: 'wash_fold', label: 'Wash · Dry · Fold' },
  { value: 'tops_knitwear', label: 'Tops & Knitwear' },
  { value: 'bottoms_dresses', label: 'Bottoms & Outerwear' },
  { value: 'bedding_home', label: 'Bedding & Home' },
];

const SERVICE_TYPE_OPTIONS: ServiceRecord['serviceType'][] = [
  'Wash · Dry · Fold',
  'Wash & Iron',
  'Steam & Iron',
  'Gentle Wash',
];

export function AdminDashboard({ onBackToStore }: AdminDashboardProps) {
  const {
    user,
    authReady,
    isAdmin,
    services,
    servicesLoadedFromDb,
    gallery,
    siteConfig,
    signInWithGoogle,
    signOutUser,
    seedDefaultServices,
  } = useFirebase();

  const [tab, setTab] = useState<AdminTab>('orders');
  const [statusFeedback, setStatusFeedback] = useState('');

  // Orders state
  const [bookings, setBookings] = useState<AdminBookingRow[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [orderFilter, setOrderFilter] = useState<'all' | AdminBookingRow['orderStatus']>('all');
  const [orderSearch, setOrderSearch] = useState('');

  // Service editor state
  const [editingService, setEditingService] = useState<ServiceRecord | null>(null);
  const [isNewService, setIsNewService] = useState(false);
  const [serviceImageBusy, setServiceImageBusy] = useState(false);
  const [serviceError, setServiceError] = useState('');
  const [seedingBusy, setSeedingBusy] = useState(false);

  // Gallery uploader state
  const [galleryTitle, setGalleryTitle] = useState('');
  const [galleryCaption, setGalleryCaption] = useState('');
  const [galleryPlacement, setGalleryPlacement] = useState<'gallery' | 'hero' | 'care'>('gallery');
  const [galleryImageUrl, setGalleryImageUrl] = useState('');
  const [galleryBusy, setGalleryBusy] = useState(false);
  const [galleryError, setGalleryError] = useState('');

  // Storefront config form state
  const [configDraft, setConfigDraft] = useState<SiteConfigData>(siteConfig);
  const [configSaving, setConfigSaving] = useState(false);

  // Admin access form
  const [adminsList, setAdminsList] = useState<AdminRecord[]>([]);
  const [newAdminUid, setNewAdminUid] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminName, setNewAdminName] = useState('');

  // Customers directory state
  const [customers, setCustomers] = useState<AdminCustomerRow[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [editingCustomer, setEditingCustomer] = useState<AdminCustomerRow | null>(null);
  const [savingCustomer, setSavingCustomer] = useState(false);

  useEffect(() => {
    setConfigDraft(siteConfig);
  }, [siteConfig]);

  // Listen to all bookings when admin is authenticated
  useEffect(() => {
    if (!authReady || !user || !isAdmin) {
      setBookings([]);
      return;
    }

    setLoadingBookings(true);
    const q = query(collection(db, 'bookings'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const rows: AdminBookingRow[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            orderCode: String(data.orderCode ?? ''),
            userId: String(data.userId ?? ''),
            customerEmail: String(data.customerEmail ?? ''),
            isGuest: Boolean(data.isGuest ?? true),
            pickupDateIso: String(data.pickupDateIso ?? ''),
            pickupDayLabel: String(data.pickupDayLabel ?? ''),
            pickupSlotId: String(data.pickupSlotId ?? 'morning'),
            pickupWindow: String(data.pickupWindow ?? ''),
            turnaround: data.turnaround === 'express' ? 'express' : 'standard',
            fullName: String(data.fullName ?? ''),
            phone: String(data.phone ?? ''),
            address: String(data.address ?? ''),
            postalCode: String(data.postalCode ?? ''),
            notes: String(data.notes ?? ''),
            items: Array.isArray(data.items) ? data.items : [],
            detergent: String(data.detergent ?? 'signature'),
            washTemp: String(data.washTemp ?? 'cold'),
            finish: String(data.finish ?? 'folded'),
            paymentMethod: String(data.paymentMethod ?? 'paynow'),
            paymentStatus: data.paymentStatus === 'paid' ? 'paid' : 'pending',
            orderStatus: data.orderStatus ?? 'booked',
            subtotal: Number(data.subtotal ?? 0),
            loyaltyDiscountRate: Number(data.loyaltyDiscountRate ?? 0),
            loyaltyDiscountAmount: Number(data.loyaltyDiscountAmount ?? 0),
            deliveryFee: Number(data.deliveryFee ?? 0),
            expressFee: Number(data.expressFee ?? 0),
            total: Number(data.total ?? 0),
          };
        });
        setBookings(rows);
        setLoadingBookings(false);
      },
      (error) => {
        setLoadingBookings(false);
        handleFirestoreError(error, OperationType.LIST, 'bookings');
      }
    );

    return () => unsub();
  }, [authReady, user, isAdmin]);

  // Listen to /admins list
  useEffect(() => {
    if (!authReady || !user || !isAdmin) {
      setAdminsList([]);
      return;
    }
    const unsub = onSnapshot(
      collection(db, 'admins'),
      (snap) => {
        setAdminsList(
          snap.docs.map((d) => ({
            uid: d.id,
            email: String(d.data().email ?? ''),
            displayName: String(d.data().displayName ?? ''),
          }))
        );
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'admins');
      }
    );
    return () => unsub();
  }, [authReady, user, isAdmin]);

  // Listen to signed-in /users directory when admin is authenticated
  useEffect(() => {
    if (!authReady || !user || !isAdmin) {
      setCustomers([]);
      return;
    }
    setLoadingCustomers(true);
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: AdminCustomerRow[] = snap.docs.map((d) => {
          const data = d.data();
          const createdTs = data.createdAt as { toDate?: () => Date } | undefined;
          const joinedAtLabel = createdTs?.toDate
            ? createdTs.toDate().toLocaleDateString('en-US', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })
            : '—';
          return {
            uid: String(data.uid ?? d.id),
            email: String(data.email ?? ''),
            displayName: String(data.displayName ?? ''),
            photoURL: String(data.photoURL ?? ''),
            phone: String(data.phone ?? ''),
            address: String(data.address ?? ''),
            postalCode: String(data.postalCode ?? ''),
            adminNotes: String(data.adminNotes ?? ''),
            loyaltyTier: data.loyaltyTier === 'vip' ? 'vip' : 'member',
            joinedAtLabel,
          };
        });
        setCustomers(rows);
        setLoadingCustomers(false);
      },
      (error) => {
        setLoadingCustomers(false);
        handleFirestoreError(error, OperationType.LIST, 'users');
      }
    );
    return () => unsub();
  }, [authReady, user, isAdmin]);

  function showToast(msg: string) {
    setStatusFeedback(msg);
    setTimeout(() => {
      setStatusFeedback((curr) => (curr === msg ? '' : curr));
    }, 3000);
  }

  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (orderFilter !== 'all' && b.orderStatus !== orderFilter) return false;
      if (orderSearch.trim()) {
        const needle = orderSearch.toLowerCase();
        return (
          b.orderCode.toLowerCase().includes(needle) ||
          b.fullName.toLowerCase().includes(needle) ||
          b.phone.toLowerCase().includes(needle) ||
          b.postalCode.toLowerCase().includes(needle)
        );
      }
      return true;
    });
  }, [bookings, orderFilter, orderSearch]);

  const orderMetrics = useMemo(() => {
    const activeCount = bookings.filter(
      (b) => !['completed', 'cancelled'].includes(b.orderStatus)
    ).length;
    const pendingPayCount = bookings.filter(
      (b) => b.paymentStatus === 'pending' && b.orderStatus !== 'cancelled'
    ).length;
    const revenue = bookings
      .filter((b) => b.orderStatus !== 'cancelled')
      .reduce((sum, b) => sum + b.total, 0);
    return {
      total: bookings.length,
      activeCount,
      pendingPayCount,
      revenue,
    };
  }, [bookings]);

  const enrichedCustomers = useMemo(() => {
    return customers.map((cust) => {
      const custBookings = bookings.filter(
        (b) => !b.isGuest && b.userId === cust.uid
      );
      const validBookings = custBookings.filter((b) => b.orderStatus !== 'cancelled');
      const totalSpend = validBookings.reduce((sum, b) => sum + b.total, 0);
      const totalSaved = validBookings.reduce((sum, b) => sum + b.loyaltyDiscountAmount, 0);
      const latestBooking = custBookings[0];
      return {
        ...cust,
        effectivePhone: cust.phone || latestBooking?.phone || '',
        effectiveAddress: cust.address || latestBooking?.address || '',
        effectivePostalCode: cust.postalCode || latestBooking?.postalCode || '',
        orderCount: custBookings.length,
        totalSpend,
        totalSaved,
        lastPickup: latestBooking?.pickupDayLabel || 'No orders yet',
      };
    });
  }, [customers, bookings]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return enrichedCustomers;
    const needle = customerSearch.toLowerCase();
    return enrichedCustomers.filter(
      (c) =>
        c.displayName.toLowerCase().includes(needle) ||
        c.email.toLowerCase().includes(needle) ||
        c.effectivePhone.toLowerCase().includes(needle) ||
        c.effectiveAddress.toLowerCase().includes(needle) ||
        c.effectivePostalCode.toLowerCase().includes(needle)
    );
  }, [enrichedCustomers, customerSearch]);

  function downloadCsvFile(filename: string, headers: string[], rows: (string | number)[][]) {
    const escapeCell = (val: string | number) => {
      const str = String(val ?? '');
      if (/[",\n\r]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };
    const csvLines = [
      headers.map(escapeCell).join(','),
      ...rows.map((r) => r.map(escapeCell).join(',')),
    ];
    const blob = new Blob(['\uFEFF' + csvLines.join('\r\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function handleDownloadCustomersCsv() {
    const dateSlug = new Date().toISOString().slice(0, 10);
    downloadCsvFile(
      `helpmewash-customers-${dateSlug}.csv`,
      [
        'UID',
        'Name',
        'Email',
        'Phone',
        'Address',
        'Postal Code',
        'Loyalty Tier',
        'Orders Count',
        'Total Spend ($)',
        'Loyalty Saved ($)',
        'Last Pickup',
        'Joined Date',
        'Admin Notes',
      ],
      filteredCustomers.map((c) => [
        c.uid,
        c.displayName,
        c.email,
        c.effectivePhone,
        c.effectiveAddress,
        c.effectivePostalCode,
        c.loyaltyTier.toUpperCase(),
        c.orderCount,
        c.totalSpend.toFixed(2),
        c.totalSaved.toFixed(2),
        c.lastPickup,
        c.joinedAtLabel,
        c.adminNotes,
      ])
    );
    showToast('Customers CSV downloaded');
  }

  function handleDownloadOrdersCsv() {
    const dateSlug = new Date().toISOString().slice(0, 10);
    downloadCsvFile(
      `helpmewash-orders-${dateSlug}.csv`,
      [
        'Order Code',
        'Customer Name',
        'Email',
        'Phone',
        'Address',
        'Postal Code',
        'Pickup Date',
        'Pickup Window',
        'Turnaround',
        'Order Status',
        'Payment Method',
        'Payment Status',
        'Items',
        'Total ($)',
      ],
      filteredBookings.map((b) => [
        b.orderCode,
        b.fullName,
        b.customerEmail || 'Guest',
        b.phone,
        b.address,
        b.postalCode,
        b.pickupDayLabel,
        b.pickupWindow,
        b.turnaround,
        b.orderStatus,
        b.paymentMethod,
        b.paymentStatus,
        b.items.map((i) => `${i.qty}x ${i.name}`).join('; '),
        b.total.toFixed(2),
      ])
    );
    showToast('Orders CSV downloaded');
  }

  async function handleSaveCustomer() {
    if (!editingCustomer) return;
    if (!editingCustomer.displayName.trim()) return;
    setSavingCustomer(true);
    try {
      await updateDoc(doc(db, 'users', editingCustomer.uid), {
        displayName: editingCustomer.displayName.trim().slice(0, 120),
        phone: editingCustomer.phone.trim().slice(0, 25),
        address: editingCustomer.address.trim().slice(0, 240),
        postalCode: editingCustomer.postalCode.trim().slice(0, 12),
        adminNotes: editingCustomer.adminNotes.trim().slice(0, 300),
        loyaltyTier: editingCustomer.loyaltyTier,
        updatedAt: serverTimestamp(),
      });
      setEditingCustomer(null);
      showToast('Customer profile updated');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${editingCustomer.uid}`);
    } finally {
      setSavingCustomer(false);
    }
  }

  async function handleUpdateBookingField(
    bookingId: string,
    patch: Partial<Pick<AdminBookingRow, 'orderStatus' | 'paymentStatus'>>
  ) {
    try {
      await updateDoc(doc(db, 'bookings', bookingId), {
        ...patch,
        updatedAt: serverTimestamp(),
      });
      showToast('Order updated');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `bookings/${bookingId}`);
    }
  }

  async function handleDeleteBooking(bookingId: string) {
    try {
      await deleteDoc(doc(db, 'bookings', bookingId));
      showToast('Order deleted');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `bookings/${bookingId}`);
    }
  }

  async function handleSeedServices() {
    setSeedingBusy(true);
    try {
      await seedDefaultServices();
      showToast('Default HelpMeWash catalog synced to Firestore');
    } finally {
      setSeedingBusy(false);
    }
  }

  async function handleServiceFileUpload(file: File) {
    if (!editingService) return;
    setServiceImageBusy(true);
    setServiceError('');
    try {
      const dataUrl = await compressImageToDataUrl(file, 720, 0.78);
      setEditingService({ ...editingService, imageUrl: dataUrl });
    } catch (err) {
      setServiceError(err instanceof Error ? err.message : 'Failed to process image.');
    } finally {
      setServiceImageBusy(false);
    }
  }

  async function handleSaveService() {
    if (!editingService) return;
    setServiceError('');
    const cleanId = editingService.id
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-');
    if (!cleanId || !editingService.name.trim()) {
      setServiceError('Service ID and Name are required.');
      return;
    }

    const catLabel =
      CATEGORY_OPTIONS.find((c) => c.value === editingService.category)?.label ??
      editingService.categoryLabel;

    try {
      const ref = doc(db, 'services', cleanId);
      const payload: Record<string, unknown> = {
        id: cleanId,
        name: editingService.name.trim(),
        category: editingService.category,
        categoryLabel: catLabel,
        serviceType: editingService.serviceType,
        description: editingService.description.trim(),
        price: Number(editingService.price) || 0,
        unit: editingService.unit.trim() || '/ item',
        isActive: editingService.isActive,
        featuredOnCard: Boolean(editingService.featuredOnCard),
        sortOrder: Number(editingService.sortOrder) || 1,
        updatedAt: serverTimestamp(),
      };
      if (editingService.imageUrl && editingService.imageUrl.trim()) {
        payload.imageUrl = editingService.imageUrl.trim();
      }
      if (isNewService || !servicesLoadedFromDb) {
        payload.createdAt = serverTimestamp();
        await setDoc(ref, payload);
      } else {
        await updateDoc(ref, payload);
      }
      setEditingService(null);
      setIsNewService(false);
      showToast('Service saved');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `services/${cleanId}`);
    }
  }

  async function handleDeleteService(id: string) {
    try {
      await deleteDoc(doc(db, 'services', id));
      showToast('Service removed');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `services/${id}`);
    }
  }

  async function handleGalleryFileUpload(file: File) {
    setGalleryBusy(true);
    setGalleryError('');
    try {
      const dataUrl = await compressImageToDataUrl(file, 960, 0.78);
      setGalleryImageUrl(dataUrl);
    } catch (err) {
      setGalleryError(err instanceof Error ? err.message : 'Failed to compress image.');
    } finally {
      setGalleryBusy(false);
    }
  }

  async function handleAddGalleryImage() {
    setGalleryError('');
    if (!galleryTitle.trim() || !galleryImageUrl.trim()) {
      setGalleryError('Please provide both an image title and upload a photo or paste a URL.');
      return;
    }
    const id = `img-${Date.now()}`;
    try {
      await setDoc(doc(db, 'gallery', id), {
        title: galleryTitle.trim(),
        caption: galleryCaption.trim(),
        placement: galleryPlacement,
        imageUrl: galleryImageUrl.trim(),
        isVisible: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      // Also update hero/care image in siteConfig if selected
      if (galleryPlacement === 'hero' || galleryPlacement === 'care') {
        const nextConfig = {
          ...configDraft,
          ...(galleryPlacement === 'hero' ? { heroImageUrl: galleryImageUrl.trim() } : {}),
          ...(galleryPlacement === 'care' ? { careImageUrl: galleryImageUrl.trim() } : {}),
        };
        await setDoc(doc(db, 'siteConfig', 'storefront'), {
          ...nextConfig,
          updatedAt: serverTimestamp(),
        });
      }
      setGalleryTitle('');
      setGalleryCaption('');
      setGalleryImageUrl('');
      setGalleryPlacement('gallery');
      showToast('Image added to HelpMeWash');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `gallery/${id}`);
    }
  }

  async function handleToggleGalleryVisibility(id: string, current: boolean) {
    try {
      await updateDoc(doc(db, 'gallery', id), {
        isVisible: !current,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `gallery/${id}`);
    }
  }

  async function handleDeleteGalleryImage(id: string) {
    try {
      await deleteDoc(doc(db, 'gallery', id));
      showToast('Image deleted');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `gallery/${id}`);
    }
  }

  async function handleSaveSiteConfig() {
    setConfigSaving(true);
    try {
      await setDoc(doc(db, 'siteConfig', 'storefront'), {
        ...configDraft,
        updatedAt: serverTimestamp(),
      });
      showToast('Storefront settings saved');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'siteConfig/storefront');
    } finally {
      setConfigSaving(false);
    }
  }

  async function handleConfigImageUpload(field: 'heroImageUrl' | 'careImageUrl', file: File) {
    try {
      const dataUrl = await compressImageToDataUrl(file, 960, 0.78);
      setConfigDraft((prev) => ({ ...prev, [field]: dataUrl }));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Image upload failed');
    }
  }

  async function handleAddAdmin() {
    const uid = newAdminUid.trim();
    const email = newAdminEmail.trim();
    const displayName = newAdminName.trim() || email;
    if (!uid || !email) return;
    try {
      await setDoc(doc(db, 'admins', uid), {
        uid,
        email,
        displayName,
        createdAt: serverTimestamp(),
      });
      setNewAdminUid('');
      setNewAdminEmail('');
      setNewAdminName('');
      showToast('Admin added');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `admins/${uid}`);
    }
  }

  async function handleRemoveAdmin(uid: string) {
    try {
      await deleteDoc(doc(db, 'admins', uid));
      showToast('Admin removed');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `admins/${uid}`);
    }
  }

  // Gate: Not signed in or not an admin
  if (!user || !isAdmin) {
    return (
      <section className="py-12 sm:py-16 bg-[#F7F3EA] min-h-[75vh]">
        <div className="max-w-[540px] mx-auto px-4 sm:px-6">
          <button
            type="button"
            onClick={onBackToStore}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#0E2742] hover:underline mb-6 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Back to HelpMeWash Storefront</span>
          </button>

          <div className="bg-white rounded-2xl border border-[#E2D9C5] p-6 sm:p-8 text-center space-y-5">
            <div className="w-14 h-14 rounded-full bg-[#0E2742] text-[#EBBF4B] flex items-center justify-center mx-auto">
              <Shield className="w-7 h-7" aria-hidden="true" />
            </div>

            <div className="space-y-2">
              <h1 className="font-display font-extrabold text-2xl text-[#0E2742]">
                HelpMeWash Admin Portal
              </h1>
              {!user ? (
                <p className="text-sm text-[#44596F]">
                  Sign in with your administrator Google account ({BOOTSTRAPPED_ADMIN_EMAIL}) to
                  manage orders, prices, and site images.
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-red-700 font-medium">
                    Signed in as {user.email}, which does not have Admin permissions.
                  </p>
                  <p className="text-xs text-[#44596F]">
                    Your UID: <span className="font-mono select-all">{user.uid}</span>
                  </p>
                </div>
              )}
            </div>

            {!user ? (
              <button
                type="button"
                onClick={() => void signInWithGoogle()}
                className="w-full px-6 py-3.5 min-h-[48px] bg-[#0E2742] hover:bg-[#173B63] text-white font-display font-bold text-sm rounded-xl transition-colors cursor-pointer"
              >
                Admin Sign In with Google
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void signOutUser()}
                className="w-full px-6 py-3 min-h-[44px] border border-[#D8CEB8] hover:bg-[#F7F3EA] text-[#0E2742] font-bold text-sm rounded-xl transition-colors cursor-pointer"
              >
                Sign Out &amp; Switch Account
              </button>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-8 sm:py-12 bg-[#F7F3EA] min-h-[80vh]">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 space-y-6">
        {/* Top Admin Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-[#0E2742] text-white rounded-2xl p-5 sm:p-6 border-b-4 border-[#EBBF4B]">
          <div>
            <button
              type="button"
              onClick={onBackToStore}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#EBBF4B] hover:underline mb-2 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Return to Storefront</span>
            </button>
            <h1 className="font-display font-extrabold text-2xl text-white">
              HelpMeWash Admin Console
            </h1>
            <p className="text-xs text-white/75 mt-0.5">
              Signed in as {user.email}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {statusFeedback && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#EBBF4B] text-[#0E2742] text-xs font-bold">
                <Check className="w-3.5 h-3.5" aria-hidden="true" />
                {statusFeedback}
              </span>
            )}
            <button
              type="button"
              onClick={() => void signOutUser()}
              className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold cursor-pointer transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 p-1.5 bg-white rounded-xl border border-[#E2D9C5]">
          <button
            type="button"
            onClick={() => setTab('orders')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 min-h-[42px] rounded-lg text-sm font-bold transition-colors cursor-pointer ${
              tab === 'orders'
                ? 'bg-[#0E2742] text-white'
                : 'text-[#44596F] hover:text-[#0E2742] hover:bg-[#F7F3EA]'
            }`}
          >
            <ShoppingBag className="w-4 h-4" aria-hidden="true" />
            <span>Orders ({bookings.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('customers')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 min-h-[42px] rounded-lg text-sm font-bold transition-colors cursor-pointer ${
              tab === 'customers'
                ? 'bg-[#0E2742] text-white'
                : 'text-[#44596F] hover:text-[#0E2742] hover:bg-[#F7F3EA]'
            }`}
          >
            <Users className="w-4 h-4" aria-hidden="true" />
            <span>Customers ({customers.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('services')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 min-h-[42px] rounded-lg text-sm font-bold transition-colors cursor-pointer ${
              tab === 'services'
                ? 'bg-[#0E2742] text-white'
                : 'text-[#44596F] hover:text-[#0E2742] hover:bg-[#F7F3EA]'
            }`}
          >
            <Database className="w-4 h-4" aria-hidden="true" />
            <span>Services &amp; Prices</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('images')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 min-h-[42px] rounded-lg text-sm font-bold transition-colors cursor-pointer ${
              tab === 'images'
                ? 'bg-[#0E2742] text-white'
                : 'text-[#44596F] hover:text-[#0E2742] hover:bg-[#F7F3EA]'
            }`}
          >
            <ImageIcon className="w-4 h-4" aria-hidden="true" />
            <span>Images &amp; Storefront</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('access')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 min-h-[42px] rounded-lg text-sm font-bold transition-colors cursor-pointer ${
              tab === 'access'
                ? 'bg-[#0E2742] text-white'
                : 'text-[#44596F] hover:text-[#0E2742] hover:bg-[#F7F3EA]'
            }`}
          >
            <Settings className="w-4 h-4" aria-hidden="true" />
            <span>Admin Access</span>
          </button>
        </div>

        {/* TAB 1: ORDERS */}
        {tab === 'orders' && (
          <div className="space-y-5">
            {/* 4-Column KPI Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div className="bg-white rounded-xl border border-[#E2D9C5] p-4">
                <span className="block text-xs font-semibold text-[#44596F]">Total Orders</span>
                <span className="font-display font-extrabold text-2xl text-[#0E2742] tabular-nums">
                  {orderMetrics.total}
                </span>
              </div>
              <div className="bg-white rounded-xl border border-[#E2D9C5] p-4">
                <span className="block text-xs font-semibold text-[#44596F]">Active Pipeline</span>
                <span className="font-display font-extrabold text-2xl text-[#0E2742] tabular-nums">
                  {orderMetrics.activeCount}
                </span>
              </div>
              <div className="bg-white rounded-xl border border-[#E2D9C5] p-4">
                <span className="block text-xs font-semibold text-[#44596F]">
                  Pending Payment
                </span>
                <span className="font-display font-extrabold text-2xl text-[#0E2742] tabular-nums">
                  {orderMetrics.pendingPayCount}
                </span>
              </div>
              <div className="bg-white rounded-xl border border-[#E2D9C5] p-4">
                <span className="block text-xs font-semibold text-[#44596F]">Booked Revenue</span>
                <span className="font-display font-extrabold text-2xl text-[#0E2742] tabular-nums">
                  {formatCurrency(orderMetrics.revenue)}
                </span>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="bg-white rounded-2xl border border-[#E2D9C5] p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setOrderFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                    orderFilter === 'all'
                      ? 'bg-[#0E2742] text-white'
                      : 'bg-[#F7F3EA] text-[#0E2742] hover:bg-[#EBBF4B]'
                  }`}
                >
                  All
                </button>
                {ORDER_STATUSES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setOrderFilter(s.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                      orderFilter === s.value
                        ? 'bg-[#0E2742] text-white'
                        : 'bg-[#F7F3EA] text-[#0E2742] hover:bg-[#EBBF4B]'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search
                    className="w-4 h-4 text-[#44596F] absolute left-3 top-1/2 -translate-y-1/2"
                    aria-hidden="true"
                  />
                  <input
                    type="text"
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    placeholder="Search order #, name, phone..."
                    className="w-full pl-9 pr-3 py-2 min-h-[40px] bg-[#FCFBF8] border border-[#D8CEB8] rounded-xl text-sm text-[#0E2742] focus:outline-none focus:ring-2 focus:ring-[#0E2742]"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleDownloadOrdersCsv}
                  disabled={filteredBookings.length === 0}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl bg-[#0E2742] hover:bg-[#173B63] text-white text-xs font-bold cursor-pointer disabled:opacity-50 whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5 text-[#EBBF4B]" aria-hidden="true" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {/* Orders Table / Cards */}
            {loadingBookings ? (
              <div className="bg-white rounded-2xl border border-[#E2D9C5] p-8 text-center text-sm text-[#44596F]">
                Loading orders...
              </div>
            ) : filteredBookings.length === 0 ? (
              <div className="bg-white rounded-2xl border border-[#E2D9C5] p-8 text-center text-sm text-[#44596F]">
                No orders match this filter yet.
              </div>
            ) : (
              <div className="space-y-3.5">
                {filteredBookings.map((order) => (
                  <div
                    key={order.id}
                    className="bg-white rounded-2xl border border-[#E2D9C5] p-5 space-y-4"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-3 border-b border-[#EFE9DA]">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2.5 text-sm">
                          <span className="font-mono font-bold text-base text-[#0E2742]">
                            {order.orderCode}
                          </span>
                          <span aria-hidden="true" className="text-[#D8CEB8]">
                            ·
                          </span>
                          <span className="font-bold text-[#0E2742]">{order.fullName}</span>
                          <span aria-hidden="true" className="text-[#D8CEB8]">
                            ·
                          </span>
                          <span className="text-[#44596F] tabular-nums">{order.phone}</span>
                          <span aria-hidden="true" className="text-[#D8CEB8]">
                            ·
                          </span>
                          <span className="text-xs font-semibold text-[#44596F]">
                            {order.isGuest ? 'Guest Checkout' : `Loyalty (${order.customerEmail})`}
                          </span>
                        </div>
                        <p className="text-xs text-[#44596F]">
                          {order.address}, {order.postalCode}
                          {order.notes ? ` · Note: ${order.notes}` : ''}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5">
                        <select
                          aria-label={`Order status for ${order.orderCode}`}
                          value={order.orderStatus}
                          onChange={(e) =>
                            void handleUpdateBookingField(order.id, {
                              orderStatus: e.target.value as AdminBookingRow['orderStatus'],
                            })
                          }
                          className="px-3 py-2 min-h-[38px] bg-[#F7F3EA] border border-[#D8CEB8] rounded-lg text-xs font-bold text-[#0E2742] cursor-pointer"
                        >
                          {ORDER_STATUSES.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          onClick={() =>
                            void handleUpdateBookingField(order.id, {
                              paymentStatus:
                                order.paymentStatus === 'paid' ? 'pending' : 'paid',
                            })
                          }
                          className={`px-3 py-2 min-h-[38px] rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                            order.paymentStatus === 'paid'
                              ? 'bg-[#0E2742] text-[#EBBF4B]'
                              : 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                          }`}
                        >
                          {order.paymentStatus === 'paid' ? 'Paid' : 'Mark Paid'}
                        </button>

                        <a
                          href={`https://wa.me/65${order.phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                            `Hi ${order.fullName}, update on your HelpMeWash order ${order.orderCode}: status is now ${order.orderStatus.replace(/_/g, ' ')}.`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-2 min-h-[38px] rounded-lg border border-[#D8CEB8] hover:bg-[#F7F3EA] text-xs font-bold text-[#0E2742]"
                        >
                          <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>WhatsApp</span>
                        </a>

                        <button
                          type="button"
                          aria-label={`Delete order ${order.orderCode}`}
                          onClick={() => void handleDeleteBooking(order.id)}
                          className="p-2 min-h-[38px] min-w-[38px] rounded-lg border border-red-200 text-red-700 hover:bg-red-50 flex items-center justify-center cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-[#44596F]">
                      <div>
                        <span className="font-semibold text-[#0E2742]">
                          {order.pickupDayLabel} ({order.pickupWindow})
                        </span>{' '}
                        · {order.turnaround === 'express' ? 'Express Next-Day' : 'Standard 48h'} ·{' '}
                        {order.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}
                      </div>
                      <div className="font-display font-extrabold text-base text-[#0E2742] tabular-nums">
                        {formatCurrency(order.total)}
                        <span className="text-xs font-normal text-[#44596F] ml-1.5">
                          ({order.paymentMethod})
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB: CUSTOMERS (SIGNED-IN LOYALTY MEMBERS) */}
        {tab === 'customers' && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-[#E2D9C5] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="font-display font-bold text-lg text-[#0E2742]">
                  Signed-In Customer Directory
                </h2>
                <p className="text-xs text-[#44596F]">
                  View, edit saved contact details, or download signed-in loyalty members as CSV.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative w-full sm:w-64">
                  <Search
                    className="w-4 h-4 text-[#44596F] absolute left-3 top-1/2 -translate-y-1/2"
                    aria-hidden="true"
                  />
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    placeholder="Search name, email, phone..."
                    className="w-full pl-9 pr-3 py-2 min-h-[40px] bg-[#FCFBF8] border border-[#D8CEB8] rounded-xl text-sm text-[#0E2742] focus:outline-none focus:ring-2 focus:ring-[#0E2742]"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleDownloadCustomersCsv}
                  disabled={filteredCustomers.length === 0}
                  className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-xl bg-[#EBBF4B] hover:bg-[#DDA928] text-[#0E2742] text-xs font-bold cursor-pointer disabled:opacity-50 whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Download Customers CSV</span>
                </button>
              </div>
            </div>

            {/* Inline View & Edit Customer Card */}
            {editingCustomer && (
              <div className="bg-white rounded-2xl border-2 border-[#0E2742] p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#EFE9DA]">
                  <div>
                    <h3 className="font-display font-bold text-base text-[#0E2742]">
                      Edit Customer: {editingCustomer.displayName}
                    </h3>
                    <p className="text-xs text-[#44596F]">
                      {editingCustomer.email} · UID:{' '}
                      <span className="font-mono">{editingCustomer.uid}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingCustomer(null)}
                    className="text-xs font-semibold text-[#44596F] hover:text-[#0E2742] cursor-pointer"
                  >
                    Close
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#0E2742] mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={editingCustomer.displayName}
                      onChange={(e) =>
                        setEditingCustomer({ ...editingCustomer, displayName: e.target.value })
                      }
                      className="w-full px-3 py-2 min-h-[40px] border border-[#D8CEB8] rounded-xl text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#0E2742] mb-1">
                      Mobile / WhatsApp
                    </label>
                    <input
                      type="tel"
                      value={editingCustomer.phone}
                      onChange={(e) =>
                        setEditingCustomer({ ...editingCustomer, phone: e.target.value })
                      }
                      placeholder="e.g. 9123 4567"
                      className="w-full px-3 py-2 min-h-[40px] border border-[#D8CEB8] rounded-xl text-sm tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#0E2742] mb-1">
                      Loyalty Tier
                    </label>
                    <select
                      value={editingCustomer.loyaltyTier}
                      onChange={(e) =>
                        setEditingCustomer({
                          ...editingCustomer,
                          loyaltyTier: e.target.value === 'vip' ? 'vip' : 'member',
                        })
                      }
                      className="w-full px-3 py-2 min-h-[40px] border border-[#D8CEB8] rounded-xl text-sm bg-white"
                    >
                      <option value="member">Member (5% Off)</option>
                      <option value="vip">VIP Member</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-[#0E2742] mb-1">
                      Pickup &amp; Delivery Address
                    </label>
                    <input
                      type="text"
                      value={editingCustomer.address}
                      onChange={(e) =>
                        setEditingCustomer({ ...editingCustomer, address: e.target.value })
                      }
                      placeholder="Block, street & unit number"
                      className="w-full px-3 py-2 min-h-[40px] border border-[#D8CEB8] rounded-xl text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#0E2742] mb-1">
                      Postal Code
                    </label>
                    <input
                      type="text"
                      value={editingCustomer.postalCode}
                      onChange={(e) =>
                        setEditingCustomer({ ...editingCustomer, postalCode: e.target.value })
                      }
                      placeholder="238294"
                      className="w-full px-3 py-2 min-h-[40px] border border-[#D8CEB8] rounded-xl text-sm tabular-nums"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#0E2742] mb-1">
                    Internal Admin Notes
                  </label>
                  <input
                    type="text"
                    value={editingCustomer.adminNotes}
                    onChange={(e) =>
                      setEditingCustomer({ ...editingCustomer, adminNotes: e.target.value })
                    }
                    placeholder="e.g. Prefers fragrance-free detergent, leave parcel at concierge"
                    className="w-full px-3 py-2 min-h-[40px] border border-[#D8CEB8] rounded-xl text-sm"
                  />
                </div>

                <div className="flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setEditingCustomer(null)}
                    className="px-4 py-2 min-h-[40px] rounded-xl border border-[#D8CEB8] text-xs font-bold text-[#0E2742] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={savingCustomer}
                    onClick={() => void handleSaveCustomer()}
                    className="px-5 py-2 min-h-[40px] rounded-xl bg-[#0E2742] hover:bg-[#173B63] text-white text-xs font-bold cursor-pointer disabled:opacity-60"
                  >
                    {savingCustomer ? 'Saving...' : 'Save Customer Details'}
                  </button>
                </div>
              </div>
            )}

            {/* Customers Directory List */}
            {loadingCustomers ? (
              <div className="bg-white rounded-2xl border border-[#E2D9C5] p-8 text-center text-sm text-[#44596F]">
                Loading signed-in customers...
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="bg-white rounded-2xl border border-[#E2D9C5] p-8 text-center text-sm text-[#44596F]">
                No signed-in customers found yet. Customers appear here automatically after signing in
                with Google.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredCustomers.map((cust) => (
                  <div
                    key={cust.uid}
                    className="bg-white rounded-2xl border border-[#E2D9C5] p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
                  >
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="w-11 h-11 rounded-full bg-[#0E2742] text-[#EBBF4B] font-display font-bold text-sm flex items-center justify-center shrink-0 overflow-hidden">
                        {cust.photoURL ? (
                          <img
                            src={cust.photoURL}
                            alt={cust.displayName}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          cust.displayName.slice(0, 2).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-display font-bold text-[#0E2742]">
                            {cust.displayName}
                          </span>
                          <span aria-hidden="true" className="text-[#D8CEB8]">
                            ·
                          </span>
                          <span className="text-xs font-semibold text-[#44596F]">
                            {cust.loyaltyTier === 'vip' ? 'VIP Member' : 'Loyalty Member'}
                          </span>
                          <span aria-hidden="true" className="text-[#D8CEB8]">
                            ·
                          </span>
                          <span className="text-xs text-[#44596F]">Joined {cust.joinedAtLabel}</span>
                        </div>
                        <p className="text-xs text-[#44596F]">
                          {cust.email}
                          {cust.effectivePhone ? ` · ${cust.effectivePhone}` : ''}
                        </p>
                        {(cust.effectiveAddress || cust.effectivePostalCode) && (
                          <p className="text-xs text-[#0E2742]">
                            {cust.effectiveAddress}
                            {cust.effectivePostalCode ? `, ${cust.effectivePostalCode}` : ''}
                          </p>
                        )}
                        {cust.adminNotes && (
                          <p className="text-xs text-[#44596F] italic">
                            Note: {cust.adminNotes}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 shrink-0">
                      <div className="text-right">
                        <span className="block text-xs text-[#44596F]">
                          {cust.orderCount} {cust.orderCount === 1 ? 'order' : 'orders'}
                        </span>
                        <span className="font-display font-extrabold text-base text-[#0E2742] tabular-nums">
                          {formatCurrency(cust.totalSpend)}
                        </span>
                      </div>

                      {cust.effectivePhone && (
                        <a
                          href={`https://wa.me/65${cust.effectivePhone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-2 min-h-[38px] rounded-lg border border-[#D8CEB8] hover:bg-[#F7F3EA] text-xs font-bold text-[#0E2742]"
                        >
                          <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>WhatsApp</span>
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          setEditingCustomer({
                            uid: cust.uid,
                            email: cust.email,
                            displayName: cust.displayName,
                            photoURL: cust.photoURL,
                            phone: cust.effectivePhone,
                            address: cust.effectiveAddress,
                            postalCode: cust.effectivePostalCode,
                            adminNotes: cust.adminNotes,
                            loyaltyTier: cust.loyaltyTier,
                            joinedAtLabel: cust.joinedAtLabel,
                          })
                        }
                        className="px-3.5 py-2 min-h-[38px] rounded-lg bg-[#F7F3EA] hover:bg-[#EBBF4B] text-xs font-bold text-[#0E2742] cursor-pointer"
                      >
                        View / Edit
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: SERVICES & PRICING */}
        {tab === 'services' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-2xl border border-[#E2D9C5] p-5">
              <div>
                <h2 className="font-display font-bold text-lg text-[#0E2742]">
                  Laundry Services &amp; Per-Item Pricing
                </h2>
                <p className="text-xs text-[#44596F]">
                  Edit pricing, toggle availability, or upload photos for each service item.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                {!servicesLoadedFromDb && (
                  <button
                    type="button"
                    disabled={seedingBusy}
                    onClick={() => void handleSeedServices()}
                    className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[42px] bg-[#0E2742] text-white text-xs font-bold rounded-xl cursor-pointer hover:bg-[#173B63]"
                  >
                    <Database className="w-4 h-4 text-[#EBBF4B]" aria-hidden="true" />
                    <span>{seedingBusy ? 'Syncing...' : 'Sync Default Catalog to DB'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setIsNewService(true);
                    setServiceError('');
                    setEditingService({
                      id: `item-${Date.now().toString().slice(-4)}`,
                      name: '',
                      category: 'tops_knitwear',
                      categoryLabel: 'Tops & Knitwear',
                      serviceType: 'Wash & Iron',
                      description: '',
                      price: 4.9,
                      unit: '/ item',
                      isActive: true,
                      featuredOnCard: false,
                      sortOrder: services.length + 1,
                    });
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[42px] bg-[#EBBF4B] hover:bg-[#DDA928] text-[#0E2742] text-xs font-bold rounded-xl cursor-pointer"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  <span>Add Service Item</span>
                </button>
              </div>
            </div>

            {/* Service Editor Modal / Inline Card */}
            {editingService && (
              <div className="bg-white rounded-2xl border-2 border-[#0E2742] p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-bold text-base text-[#0E2742]">
                    {isNewService ? 'New Service Item' : `Edit: ${editingService.name}`}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setEditingService(null)}
                    className="text-xs font-semibold text-[#44596F] hover:text-[#0E2742] cursor-pointer"
                  >
                    Close
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#0E2742] mb-1">
                      Service Name
                    </label>
                    <input
                      type="text"
                      value={editingService.name}
                      onChange={(e) =>
                        setEditingService({ ...editingService, name: e.target.value })
                      }
                      className="w-full px-3 py-2 min-h-[40px] border border-[#D8CEB8] rounded-xl text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#0E2742] mb-1">
                      Category
                    </label>
                    <select
                      value={editingService.category}
                      onChange={(e) =>
                        setEditingService({
                          ...editingService,
                          category: e.target.value as ServiceCategory,
                        })
                      }
                      className="w-full px-3 py-2 min-h-[40px] border border-[#D8CEB8] rounded-xl text-sm bg-white"
                    >
                      {CATEGORY_OPTIONS.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#0E2742] mb-1">
                      Care Type
                    </label>
                    <select
                      value={editingService.serviceType}
                      onChange={(e) =>
                        setEditingService({
                          ...editingService,
                          serviceType: e.target.value as ServiceRecord['serviceType'],
                        })
                      }
                      className="w-full px-3 py-2 min-h-[40px] border border-[#D8CEB8] rounded-xl text-sm bg-white"
                    >
                      {SERVICE_TYPE_OPTIONS.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#0E2742] mb-1">
                      Price ($)
                    </label>
                    <input
                      type="number"
                      step="0.10"
                      value={editingService.price}
                      onChange={(e) =>
                        setEditingService({
                          ...editingService,
                          price: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-3 py-2 min-h-[40px] border border-[#D8CEB8] rounded-xl text-sm tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#0E2742] mb-1">
                      Unit Label
                    </label>
                    <input
                      type="text"
                      value={editingService.unit}
                      onChange={(e) =>
                        setEditingService({ ...editingService, unit: e.target.value })
                      }
                      placeholder="/ item"
                      className="w-full px-3 py-2 min-h-[40px] border border-[#D8CEB8] rounded-xl text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#0E2742] mb-1">
                      Sort Order
                    </label>
                    <input
                      type="number"
                      value={editingService.sortOrder}
                      onChange={(e) =>
                        setEditingService({
                          ...editingService,
                          sortOrder: parseInt(e.target.value, 10) || 1,
                        })
                      }
                      className="w-full px-3 py-2 min-h-[40px] border border-[#D8CEB8] rounded-xl text-sm tabular-nums"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#0E2742] mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={editingService.description}
                    onChange={(e) =>
                      setEditingService({ ...editingService, description: e.target.value })
                    }
                    className="w-full px-3 py-2 min-h-[40px] border border-[#D8CEB8] rounded-xl text-sm"
                  />
                </div>

                {/* Service Image Upload */}
                <div className="bg-[#F7F3EA] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="w-20 h-20 rounded-xl bg-white border border-[#D8CEB8] overflow-hidden shrink-0 flex items-center justify-center">
                    {editingService.imageUrl ? (
                      <img
                        src={editingService.imageUrl}
                        alt={editingService.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-[#44596F]" aria-hidden="true" />
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0E2742] text-white text-xs font-bold cursor-pointer hover:bg-[#173B63]">
                        <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{serviceImageBusy ? 'Compressing...' : 'Upload Photo'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void handleServiceFileUpload(f);
                          }}
                        />
                      </label>
                      {editingService.imageUrl && (
                        <button
                          type="button"
                          onClick={() =>
                            setEditingService({ ...editingService, imageUrl: undefined })
                          }
                          className="px-3 py-2 rounded-lg border border-[#D8CEB8] bg-white text-xs font-semibold text-[#0E2742] cursor-pointer"
                        >
                          Remove Photo
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={editingService.imageUrl ?? ''}
                      onChange={(e) =>
                        setEditingService({
                          ...editingService,
                          imageUrl: e.target.value || undefined,
                        })
                      }
                      placeholder="Or paste an image URL..."
                      className="w-full px-3 py-1.5 bg-white border border-[#D8CEB8] rounded-lg text-xs"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                  <div className="flex items-center gap-5 text-xs font-semibold text-[#0E2742]">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingService.isActive}
                        onChange={(e) =>
                          setEditingService({ ...editingService, isActive: e.target.checked })
                        }
                      />
                      <span>Active on Storefront</span>
                    </label>
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(editingService.featuredOnCard)}
                        onChange={(e) =>
                          setEditingService({
                            ...editingService,
                            featuredOnCard: e.target.checked,
                          })
                        }
                      />
                      <span>Show on Rate Table</span>
                    </label>
                  </div>

                  <div className="flex items-center gap-2.5">
                    {serviceError && <span className="text-xs text-red-700">{serviceError}</span>}
                    <button
                      type="button"
                      onClick={() => void handleSaveService()}
                      className="px-5 py-2.5 min-h-[42px] bg-[#EBBF4B] hover:bg-[#DDA928] text-[#0E2742] font-display font-bold text-sm rounded-xl cursor-pointer"
                    >
                      Save Service
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Services List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {services.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-xl border border-[#E2D9C5] p-4 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-14 h-14 rounded-xl bg-[#F7F3EA] border border-[#E2D9C5] overflow-hidden shrink-0 flex items-center justify-center">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="w-5 h-5 text-[#44596F]" aria-hidden="true" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase text-[#44596F] truncate">
                        {item.categoryLabel} · {item.isActive ? 'Active' : 'Hidden'}
                      </p>
                      <h4 className="font-display font-bold text-sm text-[#0E2742] truncate">
                        {item.name}
                      </h4>
                      <p className="text-sm font-extrabold text-[#0E2742] tabular-nums">
                        {formatCurrency(item.price)}{' '}
                        <span className="text-xs font-normal text-[#44596F]">{item.unit}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setIsNewService(false);
                        setServiceError('');
                        setEditingService({ ...item });
                      }}
                      className="px-3 py-1.5 min-h-[36px] rounded-lg bg-[#F7F3EA] hover:bg-[#EBBF4B] text-xs font-bold text-[#0E2742] cursor-pointer"
                    >
                      Edit
                    </button>
                    {servicesLoadedFromDb && (
                      <button
                        type="button"
                        aria-label={`Delete ${item.name}`}
                        onClick={() => void handleDeleteService(item.id)}
                        className="p-2 min-h-[36px] rounded-lg border border-red-200 text-red-700 hover:bg-red-50 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: IMAGES & STOREFRONT */}
        {tab === 'images' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Add Gallery / Showcase Image */}
            <div className="lg:col-span-6 space-y-5">
              <div className="bg-white rounded-2xl border border-[#E2D9C5] p-5 sm:p-6 space-y-4">
                <div>
                  <h2 className="font-display font-bold text-lg text-[#0E2742]">
                    Add Showcase / Studio Photos
                  </h2>
                  <p className="text-xs text-[#44596F]">
                    Upload folded laundry photos, garment care shots, or swap the Hero / Care
                    banner image.
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#0E2742] mb-1">
                      Photo Title
                    </label>
                    <input
                      type="text"
                      value={galleryTitle}
                      onChange={(e) => setGalleryTitle(e.target.value)}
                      placeholder="e.g. Freshly Folded Linen Stack"
                      className="w-full px-3.5 py-2 min-h-[40px] border border-[#D8CEB8] rounded-xl text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#0E2742] mb-1">
                      Caption
                    </label>
                    <input
                      type="text"
                      value={galleryCaption}
                      onChange={(e) => setGalleryCaption(e.target.value)}
                      placeholder="e.g. Same-day tumble dry and crisp folding"
                      className="w-full px-3.5 py-2 min-h-[40px] border border-[#D8CEB8] rounded-xl text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#0E2742] mb-1">
                      Placement
                    </label>
                    <select
                      value={galleryPlacement}
                      onChange={(e) =>
                        setGalleryPlacement(e.target.value as 'gallery' | 'hero' | 'care')
                      }
                      className="w-full px-3.5 py-2 min-h-[40px] border border-[#D8CEB8] rounded-xl text-sm bg-white"
                    >
                      <option value="gallery">Studio Photo Gallery</option>
                      <option value="hero">Hero Banner Photo (Updates Hero)</option>
                      <option value="care">Quality Care Showcase Photo</option>
                    </select>
                  </div>

                  <div className="bg-[#F7F3EA] rounded-xl p-4 space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] rounded-xl bg-[#0E2742] text-white text-xs font-bold cursor-pointer hover:bg-[#173B63]">
                        <Upload className="w-4 h-4 text-[#EBBF4B]" aria-hidden="true" />
                        <span>{galleryBusy ? 'Compressing...' : 'Choose Image File'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void handleGalleryFileUpload(f);
                          }}
                        />
                      </label>
                      <span className="text-xs text-[#44596F]">or paste URL below</span>
                    </div>

                    <input
                      type="text"
                      value={galleryImageUrl}
                      onChange={(e) => setGalleryImageUrl(e.target.value)}
                      placeholder="https://... or uploaded image data"
                      className="w-full px-3 py-2 bg-white border border-[#D8CEB8] rounded-xl text-xs"
                    />

                    {galleryImageUrl && (
                      <div className="rounded-xl overflow-hidden border border-[#D8CEB8] h-40 bg-white">
                        <img
                          src={galleryImageUrl}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                  </div>

                  {galleryError && <p className="text-xs text-red-700">{galleryError}</p>}

                  <button
                    type="button"
                    onClick={() => void handleAddGalleryImage()}
                    className="w-full px-5 py-3 min-h-[44px] bg-[#EBBF4B] hover:bg-[#DDA928] text-[#0E2742] font-display font-bold text-sm rounded-xl cursor-pointer"
                  >
                    Add Photo to Website
                  </button>
                </div>
              </div>

              {/* Uploaded Gallery Items List */}
              <div className="space-y-3">
                <h3 className="font-display font-bold text-base text-[#0E2742]">
                  Uploaded Photos ({gallery.length})
                </h3>
                {gallery.length === 0 ? (
                  <p className="text-sm text-[#44596F] bg-white rounded-xl border border-[#E2D9C5] p-5">
                    No custom gallery photos uploaded yet.
                  </p>
                ) : (
                  gallery.map((g) => (
                    <div
                      key={g.id}
                      className="bg-white rounded-xl border border-[#E2D9C5] p-3.5 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={g.imageUrl}
                          alt={g.title}
                          className="w-16 h-16 rounded-lg object-cover border border-[#EFE9DA] shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-[11px] uppercase font-semibold text-[#44596F]">
                            {g.placement} · {g.isVisible ? 'Visible' : 'Hidden'}
                          </p>
                          <p className="font-display font-bold text-sm text-[#0E2742] truncate">
                            {g.title}
                          </p>
                          <p className="text-xs text-[#44596F] truncate">{g.caption}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => void handleToggleGalleryVisibility(g.id, g.isVisible)}
                          className="px-3 py-1.5 rounded-lg bg-[#F7F3EA] text-xs font-bold text-[#0E2742] cursor-pointer"
                        >
                          {g.isVisible ? 'Hide' : 'Show'}
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete ${g.title}`}
                          onClick={() => void handleDeleteGalleryImage(g.id)}
                          className="p-2 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right: Storefront Settings & Loyalty Discount */}
            <div className="lg:col-span-6 bg-white rounded-2xl border border-[#E2D9C5] p-5 sm:p-6 space-y-4">
              <div>
                <h2 className="font-display font-bold text-lg text-[#0E2742]">
                  Storefront Copy, Images &amp; Loyalty Rules
                </h2>
                <p className="text-xs text-[#44596F]">
                  Update hero text, loyalty discount %, delivery thresholds, and featured images.
                </p>
              </div>

              <div className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[#0E2742] mb-1">
                    Hero Headline
                  </label>
                  <input
                    type="text"
                    value={configDraft.heroHeadline}
                    onChange={(e) =>
                      setConfigDraft({ ...configDraft, heroHeadline: e.target.value })
                    }
                    className="w-full px-3.5 py-2 min-h-[40px] border border-[#D8CEB8] rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0E2742] mb-1">
                    Hero Subheadline
                  </label>
                  <textarea
                    rows={2}
                    value={configDraft.heroSubheadline}
                    onChange={(e) =>
                      setConfigDraft({ ...configDraft, heroSubheadline: e.target.value })
                    }
                    className="w-full px-3.5 py-2 border border-[#D8CEB8] rounded-xl text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#0E2742] mb-1">
                      Loyalty Discount (%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={50}
                      value={configDraft.loyaltyDiscountPercent}
                      onChange={(e) =>
                        setConfigDraft({
                          ...configDraft,
                          loyaltyDiscountPercent: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-3 py-2 min-h-[40px] border border-[#D8CEB8] rounded-xl text-sm tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#0E2742] mb-1">
                      Free Delivery Min ($)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={configDraft.freeDeliveryThreshold}
                      onChange={(e) =>
                        setConfigDraft({
                          ...configDraft,
                          freeDeliveryThreshold: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-3 py-2 min-h-[40px] border border-[#D8CEB8] rounded-xl text-sm tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#0E2742] mb-1">
                      Standard Delivery ($)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={configDraft.standardDeliveryFee}
                      onChange={(e) =>
                        setConfigDraft({
                          ...configDraft,
                          standardDeliveryFee: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-3 py-2 min-h-[40px] border border-[#D8CEB8] rounded-xl text-sm tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#0E2742] mb-1">
                      Express Next-Day ($)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={configDraft.expressFee}
                      onChange={(e) =>
                        setConfigDraft({
                          ...configDraft,
                          expressFee: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-3 py-2 min-h-[40px] border border-[#D8CEB8] rounded-xl text-sm tabular-nums"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#0E2742] mb-1">
                      WhatsApp Number
                    </label>
                    <input
                      type="text"
                      value={configDraft.whatsappNumber}
                      onChange={(e) =>
                        setConfigDraft({ ...configDraft, whatsappNumber: e.target.value })
                      }
                      className="w-full px-3 py-2 min-h-[40px] border border-[#D8CEB8] rounded-xl text-sm tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#0E2742] mb-1">
                      Instagram Handle
                    </label>
                    <input
                      type="text"
                      value={configDraft.instagramHandle}
                      onChange={(e) =>
                        setConfigDraft({ ...configDraft, instagramHandle: e.target.value })
                      }
                      className="w-full px-3 py-2 min-h-[40px] border border-[#D8CEB8] rounded-xl text-sm"
                    />
                  </div>
                </div>

                {/* Direct Hero & Care Banner Image Replacements */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="bg-[#F7F3EA] rounded-xl p-3 space-y-2">
                    <span className="block text-xs font-bold text-[#0E2742]">Hero Image</span>
                    <img
                      src={configDraft.heroImageUrl}
                      alt="Hero banner preview"
                      className="w-full h-24 object-cover rounded-lg border border-[#D8CEB8]"
                    />
                    <div className="flex items-center gap-2">
                      <label className="px-2.5 py-1.5 rounded-lg bg-[#0E2742] text-white text-[11px] font-bold cursor-pointer">
                        Replace
                        <input
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void handleConfigImageUpload('heroImageUrl', f);
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setConfigDraft({
                            ...configDraft,
                            heroImageUrl: DEFAULT_SITE_CONFIG.heroImageUrl,
                          })
                        }
                        className="px-2.5 py-1.5 rounded-lg bg-white border border-[#D8CEB8] text-[11px] font-semibold cursor-pointer"
                      >
                        Reset
                      </button>
                    </div>
                  </div>

                  <div className="bg-[#F7F3EA] rounded-xl p-3 space-y-2">
                    <span className="block text-xs font-bold text-[#0E2742]">
                      Quality Care Image
                    </span>
                    <img
                      src={configDraft.careImageUrl}
                      alt="Care showcase preview"
                      className="w-full h-24 object-cover rounded-lg border border-[#D8CEB8]"
                    />
                    <div className="flex items-center gap-2">
                      <label className="px-2.5 py-1.5 rounded-lg bg-[#0E2742] text-white text-[11px] font-bold cursor-pointer">
                        Replace
                        <input
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void handleConfigImageUpload('careImageUrl', f);
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setConfigDraft({
                            ...configDraft,
                            careImageUrl: DEFAULT_SITE_CONFIG.careImageUrl,
                          })
                        }
                        className="px-2.5 py-1.5 rounded-lg bg-white border border-[#D8CEB8] text-[11px] font-semibold cursor-pointer"
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={configSaving}
                  onClick={() => void handleSaveSiteConfig()}
                  className="w-full px-5 py-3 min-h-[44px] bg-[#0E2742] hover:bg-[#173B63] text-white font-display font-bold text-sm rounded-xl cursor-pointer disabled:opacity-60"
                >
                  {configSaving ? 'Saving Settings...' : 'Save Storefront Settings'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: ADMIN ACCESS */}
        {tab === 'access' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-6 bg-white rounded-2xl border border-[#E2D9C5] p-5 sm:p-6 space-y-4">
              <div>
                <h2 className="font-display font-bold text-lg text-[#0E2742]">
                  Authorized Administrators
                </h2>
                <p className="text-xs text-[#44596F]">
                  Owner account ({BOOTSTRAPPED_ADMIN_EMAIL}) is always authorized. Add staff UIDs
                  below to grant dashboard access.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#F7F3EA] border border-[#E2D9C5] text-sm">
                <p className="font-bold text-[#0E2742]">{BOOTSTRAPPED_ADMIN_EMAIL}</p>
                <p className="text-xs text-[#44596F]">Primary Owner Admin</p>
              </div>

              {adminsList.map((adm) => (
                <div
                  key={adm.uid}
                  className="p-3.5 rounded-xl border border-[#E2D9C5] flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="font-bold text-sm text-[#0E2742]">{adm.displayName}</p>
                    <p className="text-xs text-[#44596F]">
                      {adm.email} · <span className="font-mono">{adm.uid}</span>
                    </p>
                  </div>
                  {adm.uid !== user.uid && (
                    <button
                      type="button"
                      onClick={() => void handleRemoveAdmin(adm.uid)}
                      className="px-3 py-1.5 rounded-lg border border-red-200 text-red-700 text-xs font-bold hover:bg-red-50 cursor-pointer"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="lg:col-span-6 bg-white rounded-2xl border border-[#E2D9C5] p-5 sm:p-6 space-y-4">
              <h3 className="font-display font-bold text-base text-[#0E2742]">
                Add Staff Admin by UID
              </h3>
              <div className="space-y-3">
                <input
                  type="text"
                  value={newAdminUid}
                  onChange={(e) => setNewAdminUid(e.target.value)}
                  placeholder="Firebase Auth UID"
                  className="w-full px-3.5 py-2 min-h-[40px] border border-[#D8CEB8] rounded-xl text-sm font-mono"
                />
                <input
                  type="email"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  placeholder="Staff Google Email"
                  className="w-full px-3.5 py-2 min-h-[40px] border border-[#D8CEB8] rounded-xl text-sm"
                />
                <input
                  type="text"
                  value={newAdminName}
                  onChange={(e) => setNewAdminName(e.target.value)}
                  placeholder="Staff Name"
                  className="w-full px-3.5 py-2 min-h-[40px] border border-[#D8CEB8] rounded-xl text-sm"
                />
                <button
                  type="button"
                  onClick={() => void handleAddAdmin()}
                  className="px-5 py-2.5 min-h-[42px] bg-[#EBBF4B] hover:bg-[#DDA928] text-[#0E2742] font-display font-bold text-sm rounded-xl cursor-pointer"
                >
                  Grant Admin Access
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
