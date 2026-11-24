import { useFirebase } from '../contexts/FirebaseContext';

export type AppView = 'store' | 'account' | 'admin';

interface NavbarProps {
  activeView: AppView;
  totalItemsCount: number;
  onNavigateView: (view: AppView) => void;
  onJumpToBooking: () => void;
}

export function Navbar({
  activeView,
  totalItemsCount,
  onNavigateView,
  onJumpToBooking,
}: NavbarProps) {
  const { user, isAdmin, siteConfig } = useFirebase();

  return (
    <header className="sticky top-0 z-40 bg-[#0E2742]/95 backdrop-blur-sm border-b border-white/10">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            if (activeView !== 'store') {
              e.preventDefault();
              onNavigateView('store');
            }
          }}
          className="font-display text-xl sm:text-2xl font-extrabold tracking-tight whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EBBF4B] rounded"
        >
          <span className="text-[#EBBF4B]">HelpMe</span>
          <span className="text-white">Wash</span>
        </a>

        {/* Zone 2: 4–5 concise single-line navigation links */}
        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-7 text-sm font-medium text-white/85"
        >
          <a
            href="#booking"
            onClick={(e) => {
              e.preventDefault();
              onNavigateView('store');
              setTimeout(() => onJumpToBooking(), 30);
            }}
            className="hover:text-[#EBBF4B] transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 border-transparent hover:border-[#EBBF4B]"
          >
            Book Slot
          </a>
          <a
            href="#services"
            onClick={(e) => {
              if (activeView !== 'store') {
                e.preventDefault();
                onNavigateView('store');
              }
            }}
            className="hover:text-[#EBBF4B] transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 border-transparent hover:border-[#EBBF4B]"
          >
            Pricing
          </a>
          <a
            href="#why-us"
            onClick={(e) => {
              if (activeView !== 'store') {
                e.preventDefault();
                onNavigateView('store');
              }
            }}
            className="hover:text-[#EBBF4B] transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 border-transparent hover:border-[#EBBF4B]"
          >
            Why Us
          </a>
          <button
            type="button"
            onClick={() => onNavigateView('account')}
            className={`transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 cursor-pointer ${
              activeView === 'account'
                ? 'text-[#EBBF4B] border-[#EBBF4B]'
                : 'border-transparent hover:text-[#EBBF4B] hover:border-[#EBBF4B]'
            }`}
          >
            {user ? 'My Orders' : `${siteConfig.loyaltyDiscountPercent}% Loyalty`}
          </button>
          <button
            type="button"
            onClick={() => onNavigateView('admin')}
            className={`transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 cursor-pointer ${
              activeView === 'admin'
                ? 'text-[#EBBF4B] border-[#EBBF4B]'
                : 'border-transparent hover:text-[#EBBF4B] hover:border-[#EBBF4B]'
            }`}
          >
            {isAdmin ? 'Admin Console' : 'Admin'}
          </button>
        </nav>

        {/* Zone 3: Single Primary Action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => {
              onNavigateView('store');
              setTimeout(() => onJumpToBooking(), 30);
            }}
            className="px-4 py-2 min-h-[40px] text-sm font-bold text-[#0E2742] bg-[#EBBF4B] hover:bg-[#DDA928] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            {totalItemsCount > 0 ? `Book Pickup (${totalItemsCount})` : 'Book Pickup'}
          </button>
        </div>
      </div>
    </header>
  );
}
