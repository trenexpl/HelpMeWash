import { Instagram, MessageCircle, ShieldCheck, Tag, Clock } from 'lucide-react';
import { useFirebase } from '../contexts/FirebaseContext';
import type { AppView } from './Navbar';

interface FooterProps {
  onNavigateView: (view: AppView) => void;
}

export function Footer({ onNavigateView }: FooterProps) {
  const { siteConfig } = useFirebase();
  const whatsappClean = siteConfig.whatsappNumber.replace(/\D/g, '');
  const instagramSlug = siteConfig.instagramHandle.replace(/^@/, '');

  return (
    <footer
      id="contact"
      className="bg-white border-t border-[#E2D9C5] text-[#0E2742]"
    >
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 items-center pb-8 border-b border-[#EFE9DA]">
          {/* Instagram */}
          <a
            href={`https://instagram.com/${instagramSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3.5 group"
          >
            <div className="w-11 h-11 rounded-xl border-2 border-[#0E2742] flex items-center justify-center text-[#0E2742] group-hover:bg-[#0E2742] group-hover:text-white transition-colors shrink-0">
              <Instagram className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <span className="block text-xs text-[#44596F]">Follow us on Instagram</span>
              <span className="font-display font-bold text-base text-[#0E2742] group-hover:underline">
                {siteConfig.instagramHandle}
              </span>
            </div>
          </a>

          {/* WhatsApp */}
          <a
            href={`https://wa.me/65${whatsappClean}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3.5 group"
          >
            <div className="w-11 h-11 rounded-xl border-2 border-[#0E2742] flex items-center justify-center text-[#0E2742] group-hover:bg-[#0E2742] group-hover:text-[#EBBF4B] transition-colors shrink-0">
              <MessageCircle className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <span className="block text-xs text-[#44596F]">WhatsApp us now</span>
              <span className="font-display font-extrabold text-lg text-[#0E2742] tabular-nums group-hover:underline">
                {siteConfig.whatsappNumber}
              </span>
              <span className="block text-[11px] text-[#44596F]">
                Book your collection today!
              </span>
            </div>
          </a>

          {/* Value Prop 1 */}
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-6 h-6 text-[#0E2742] shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <h4 className="font-display font-bold text-sm text-[#0E2742]">Quality Care</h4>
              <p className="text-xs text-[#44596F] leading-snug">
                Your clothes are in good hands.
              </p>
            </div>
          </div>

          {/* Value Prop 2 */}
          <div className="flex items-start gap-3">
            <Tag className="w-6 h-6 text-[#0E2742] shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <h4 className="font-display font-bold text-sm text-[#0E2742]">Simple Pricing</h4>
              <p className="text-xs text-[#44596F] leading-snug">No hidden fees.</p>
            </div>
          </div>

          {/* Value Prop 3 */}
          <div className="flex items-start gap-3">
            <Clock className="w-6 h-6 text-[#0E2742] shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <h4 className="font-display font-bold text-sm text-[#0E2742]">Save Your Time</h4>
              <p className="text-xs text-[#44596F] leading-snug">
                More time for what matters.
              </p>
            </div>
          </div>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#44596F]">
          <p>© {new Date().getFullYear()} HelpMeWash. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-5">
            <a
              href="#booking"
              onClick={() => onNavigateView('store')}
              className="hover:text-[#0E2742] transition-colors"
            >
              Book Pickup
            </a>
            <button
              type="button"
              onClick={() => onNavigateView('account')}
              className="hover:text-[#0E2742] transition-colors cursor-pointer"
            >
              My Orders &amp; Loyalty
            </button>
            <button
              type="button"
              onClick={() => onNavigateView('admin')}
              className="hover:text-[#0E2742] transition-colors cursor-pointer"
            >
              Admin Portal
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
