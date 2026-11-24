import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  auth,
  BOOTSTRAPPED_ADMIN_EMAIL,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase';
import {
  LAUNDRY_CATALOG,
  type LaundryItem,
} from '../data/laundryCatalog';

export interface GalleryItem {
  id: string;
  title: string;
  caption: string;
  placement: 'gallery' | 'hero' | 'care';
  imageUrl: string;
  isVisible: boolean;
}

export interface SiteConfigData {
  heroHeadline: string;
  heroSubheadline: string;
  heroImageUrl: string;
  careImageUrl: string;
  whatsappNumber: string;
  instagramHandle: string;
  loyaltyDiscountPercent: number;
  freeDeliveryThreshold: number;
  standardDeliveryFee: number;
  expressFee: number;
}

export const DEFAULT_SITE_CONFIG: SiteConfigData = {
  heroHeadline: 'Laundry, made easy.',
  heroSubheadline:
    'Simple pricing for wash, dry, fold & ironing. Book your pickup slot, select your clothes, and check out in under two minutes — all to your doorstep, with no hassle.',
  heroImageUrl: '/src/assets/images/hero_folded_laundry_1795342737074.jpg',
  careImageUrl: '/src/assets/images/care_garment_rack_1795342737271.jpg',
  whatsappNumber: '8825 3809',
  instagramHandle: '@helpmewash',
  loyaltyDiscountPercent: 5,
  freeDeliveryThreshold: 30,
  standardDeliveryFee: 4,
  expressFee: 8,
};

export interface ServiceRecord extends LaundryItem {
  imageUrl?: string;
  isActive: boolean;
  sortOrder: number;
}

export interface UserProfileData {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  phone?: string;
  address?: string;
  postalCode?: string;
  adminNotes?: string;
  loyaltyTier: 'member' | 'vip';
}

interface FirebaseContextValue {
  user: User | null;
  userProfile: UserProfileData | null;
  authReady: boolean;
  isAdmin: boolean;
  authError: string;
  services: ServiceRecord[];
  servicesLoadedFromDb: boolean;
  gallery: GalleryItem[];
  siteConfig: SiteConfigData;
  signInWithGoogle: () => Promise<User | null>;
  signOutUser: () => Promise<void>;
  seedDefaultServices: () => Promise<void>;
  updateOwnProfile: (patch: {
    displayName?: string;
    phone?: string;
    address?: string;
    postalCode?: string;
  }) => Promise<void>;
  clearAuthError: () => void;
}

const FirebaseContext = createContext<FirebaseContextValue | null>(null);

const FALLBACK_SERVICES: ServiceRecord[] = LAUNDRY_CATALOG.map((item, idx) => ({
  ...item,
  isActive: true,
  sortOrder: idx + 1,
}));

export function FirebaseProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfileData | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authError, setAuthError] = useState('');
  const [dbServices, setDbServices] = useState<ServiceRecord[]>([]);
  const [servicesLoadedFromDb, setServicesLoadedFromDb] = useState(false);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [siteConfig, setSiteConfig] = useState<SiteConfigData>(DEFAULT_SITE_CONFIG);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (!nextUser) {
        setUserProfile(null);
        setIsAdmin(false);
        setAuthReady(true);
        return;
      }

      // Check admin status
      const isBootstrapped =
        nextUser.emailVerified && nextUser.email === BOOTSTRAPPED_ADMIN_EMAIL;
      let adminMatch = isBootstrapped;

      if (!adminMatch) {
        try {
          const adminSnap = await getDoc(doc(db, 'admins', nextUser.uid));
          adminMatch = adminSnap.exists();
        } catch {
          adminMatch = false;
        }
      }
      setIsAdmin(adminMatch);

      // Sync customer loyalty profile document cleanly without overwriting admin edits
      if (nextUser.emailVerified && nextUser.email) {
        const userRef = doc(db, 'users', nextUser.uid);
        try {
          const existingSnap = await getDoc(userRef);
          if (!existingSnap.exists()) {
            await setDoc(userRef, {
              uid: nextUser.uid,
              email: nextUser.email,
              displayName: (nextUser.displayName || 'HelpMeWash Member').slice(0, 120),
              photoURL: (nextUser.photoURL || '').slice(0, 500),
              loyaltyTier: 'member',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } else {
            await updateDoc(userRef, {
              photoURL: (nextUser.photoURL || '').slice(0, 500),
              updatedAt: serverTimestamp(),
            });
          }
        } catch (err) {
          console.error('Failed to sync user profile:', err);
        }
      }

      setAuthReady(true);
    });

    return () => unsub();
  }, []);

  // Subscribe to signed-in user's profile
  useEffect(() => {
    if (!authReady || !user) {
      setUserProfile(null);
      return;
    }
    const ref = doc(db, 'users', user.uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setUserProfile(null);
          return;
        }
        const d = snap.data();
        setUserProfile({
          uid: String(d.uid ?? user.uid),
          email: String(d.email ?? user.email ?? ''),
          displayName: String(d.displayName ?? user.displayName ?? 'Member'),
          photoURL: typeof d.photoURL === 'string' ? d.photoURL : undefined,
          phone: typeof d.phone === 'string' ? d.phone : undefined,
          address: typeof d.address === 'string' ? d.address : undefined,
          postalCode: typeof d.postalCode === 'string' ? d.postalCode : undefined,
          adminNotes: typeof d.adminNotes === 'string' ? d.adminNotes : undefined,
          loyaltyTier: d.loyaltyTier === 'vip' ? 'vip' : 'member',
        });
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
      }
    );
    return () => unsub();
  }, [authReady, user]);

  // Subscribe to public /services catalog
  useEffect(() => {
    const q = query(collection(db, 'services'), orderBy('sortOrder', 'asc'));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const rows: ServiceRecord[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: String(data.name ?? ''),
            category: data.category,
            categoryLabel: String(data.categoryLabel ?? ''),
            serviceType: data.serviceType,
            description: String(data.description ?? ''),
            price: Number(data.price ?? 0),
            unit: String(data.unit ?? '/ item'),
            imageUrl: typeof data.imageUrl === 'string' ? data.imageUrl : undefined,
            isActive: Boolean(data.isActive ?? true),
            featuredOnCard: Boolean(data.featuredOnCard ?? false),
            sortOrder: Number(data.sortOrder ?? 0),
          };
        });
        setDbServices(rows);
        setServicesLoadedFromDb(rows.length > 0);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'services');
      }
    );
    return () => unsub();
  }, []);

  // Subscribe to public /gallery images
  useEffect(() => {
    const q = query(collection(db, 'gallery'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const rows: GalleryItem[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            title: String(data.title ?? ''),
            caption: String(data.caption ?? ''),
            placement: data.placement ?? 'gallery',
            imageUrl: String(data.imageUrl ?? ''),
            isVisible: Boolean(data.isVisible ?? true),
          };
        });
        setGallery(rows);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'gallery');
      }
    );
    return () => unsub();
  }, []);

  // Subscribe to /siteConfig/storefront
  useEffect(() => {
    const ref = doc(db, 'siteConfig', 'storefront');
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setSiteConfig(DEFAULT_SITE_CONFIG);
          return;
        }
        const data = snap.data();
        setSiteConfig({
          heroHeadline: String(data.heroHeadline || DEFAULT_SITE_CONFIG.heroHeadline),
          heroSubheadline: String(data.heroSubheadline || DEFAULT_SITE_CONFIG.heroSubheadline),
          heroImageUrl: String(data.heroImageUrl || DEFAULT_SITE_CONFIG.heroImageUrl),
          careImageUrl: String(data.careImageUrl || DEFAULT_SITE_CONFIG.careImageUrl),
          whatsappNumber: String(data.whatsappNumber || DEFAULT_SITE_CONFIG.whatsappNumber),
          instagramHandle: String(data.instagramHandle || DEFAULT_SITE_CONFIG.instagramHandle),
          loyaltyDiscountPercent: Number(
            data.loyaltyDiscountPercent ?? DEFAULT_SITE_CONFIG.loyaltyDiscountPercent
          ),
          freeDeliveryThreshold: Number(
            data.freeDeliveryThreshold ?? DEFAULT_SITE_CONFIG.freeDeliveryThreshold
          ),
          standardDeliveryFee: Number(
            data.standardDeliveryFee ?? DEFAULT_SITE_CONFIG.standardDeliveryFee
          ),
          expressFee: Number(data.expressFee ?? DEFAULT_SITE_CONFIG.expressFee),
        });
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'siteConfig/storefront');
      }
    );
    return () => unsub();
  }, []);

  async function signInWithGoogle(): Promise<User | null> {
    setAuthError('');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Google sign-in was cancelled.';
      setAuthError(msg);
      return null;
    }
  }

  async function signOutUser(): Promise<void> {
    setAuthError('');
    await signOut(auth);
  }

  async function seedDefaultServices(): Promise<void> {
    const batch = writeBatch(db);
    FALLBACK_SERVICES.forEach((item, index) => {
      const ref = doc(db, 'services', item.id);
      batch.set(ref, {
        id: item.id,
        name: item.name,
        category: item.category,
        categoryLabel: item.categoryLabel,
        serviceType: item.serviceType,
        description: item.description,
        price: item.price,
        unit: item.unit,
        isActive: true,
        featuredOnCard: Boolean(item.featuredOnCard),
        sortOrder: index + 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    const configRef = doc(db, 'siteConfig', 'storefront');
    batch.set(configRef, {
      ...DEFAULT_SITE_CONFIG,
      updatedAt: serverTimestamp(),
    });

    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'services');
    }
  }

  async function updateOwnProfile(patch: {
    displayName?: string;
    phone?: string;
    address?: string;
    postalCode?: string;
  }): Promise<void> {
    if (!user || !user.emailVerified) return;
    const payload: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    if (patch.displayName !== undefined && patch.displayName.trim()) {
      payload.displayName = patch.displayName.trim().slice(0, 120);
    }
    if (patch.phone !== undefined) {
      payload.phone = patch.phone.trim().slice(0, 25);
    }
    if (patch.address !== undefined) {
      payload.address = patch.address.trim().slice(0, 240);
    }
    if (patch.postalCode !== undefined) {
      payload.postalCode = patch.postalCode.trim().slice(0, 12);
    }
    try {
      await updateDoc(doc(db, 'users', user.uid), payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  }

  const activeServices = useMemo(() => {
    if (dbServices.length > 0) return dbServices;
    return FALLBACK_SERVICES;
  }, [dbServices]);

  const value: FirebaseContextValue = {
    user,
    userProfile,
    authReady,
    isAdmin,
    authError,
    services: activeServices,
    servicesLoadedFromDb,
    gallery,
    siteConfig,
    signInWithGoogle,
    signOutUser,
    seedDefaultServices,
    updateOwnProfile,
    clearAuthError: () => setAuthError(''),
  };

  return <FirebaseContext.Provider value={value}>{children}</FirebaseContext.Provider>;
}

export function useFirebase(): FirebaseContextValue {
  const ctx = useContext(FirebaseContext);
  if (!ctx) {
    throw new Error('useFirebase must be used inside a FirebaseProvider');
  }
  return ctx;
}
