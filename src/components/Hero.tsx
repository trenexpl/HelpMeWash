import { useState } from 'react';
import {
  Truck,
  Waves,
  Wind,
  Layers,
  Shirt,
  Home,
  ArrowRight,
  MessageCircle,
} from 'lucide-react';

interface HeroProps {
  onStartBooking: () => void;
}

const PROCESS_STEPS = [
  { label: 'Pick Up', Icon: Truck },
  { label: 'Wash', Icon: Waves },
  { label: 'Dry', Icon: Wind },
  { label: 'Fold', Icon: Layers },
  { label: 'Iron', Icon: Shirt },
  { label: 'Deliver', Icon: Home },
];

export function Hero({ onStartBooking }: HeroProps) {
  const [imgError, setImgError] = useState(false);

  return (
    <section
      id="top"
      className="bg-[#0E2742] text-white border-b-[6px] border-[#EBBF4B]"
    >
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-10 sm:py-14 lg:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
          {/* Left Narrative & CTA Column */}
          <div className="lg:col-span-7 flex flex-col justify-between gap-7">
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-xs sm:text-sm font-medium tracking-wider text-white/80">
                <span>YOUR SPEEDY ONLINE LAUNDRY SERVICE</span>
                <span aria-hidden="true" className="text-[#EBBF4B]">
                  ·
                </span>
                <span className="text-[#EBBF4B] font-semibold">3 EASY STEPS</span>
              </div>

              <h1
                className="font-display font-extrabold tracking-tight leading-[1.06] text-white"
                style={{
                  fontSize: 'clamp(2.35rem, 4.4vw, 3.75rem)',
                  textWrap: 'balance',
                }}
              >
                Laundry,{' '}
                <span className="text-[#EBBF4B] block sm:inline">
                  made easy.
                </span>
              </h1>

              <p className="text-base sm:text-lg text-white/85 max-w-xl leading-relaxed">
                Simple pricing for wash, dry, fold &amp; ironing. Book your pickup
                slot, select your clothes, and check out in under two minutes — all
                to your doorstep, with no hassle.
              </p>
            </div>

            {/* 6-Stage Care Strip matching the HelpMeWash brand poster */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 pt-2">
              {PROCESS_STEPS.map(({ label, Icon }) => (
                <div key={label} className="flex flex-col items-center text-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-white text-[#0E2742] flex items-center justify-center shadow-sm">
                    <Icon className="w-5 h-5 stroke-[2.1]" aria-hidden="true" />
                  </div>
                  <span className="text-xs font-semibold tracking-wide text-white/95 uppercase">
                    {label}
                  </span>
                </div>
              ))}
            </div>

            {/* Primary CTA + Secondary Contact Link */}
            <div className="flex flex-wrap items-center gap-4 pt-1">
              <button
                type="button"
                onClick={onStartBooking}
                className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 min-h-[48px] bg-[#EBBF4B] hover:bg-[#DDA928] text-[#0E2742] font-display font-bold text-base rounded-xl transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <span>Start 3-Step Booking</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>

              <a
                href="#services"
                className="inline-flex items-center gap-2 px-4 py-3 min-h-[48px] text-sm font-semibold text-white/90 hover:text-[#EBBF4B] transition-colors whitespace-nowrap shrink-0"
              >
                <span>View Clear Pricing</span>
              </a>

              <a
                href="https://wa.me/6588253809"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-3 min-h-[48px] text-sm font-medium text-white/80 hover:text-[#EBBF4B] transition-colors whitespace-nowrap shrink-0"
              >
                <MessageCircle className="w-4 h-4 text-[#EBBF4B]" aria-hidden="true" />
                <span className="tabular-nums">8825 3809</span>
              </a>
            </div>
          </div>

          {/* Right Brand Photography Column */}
          <div className="lg:col-span-5 flex">
            <div className="relative w-full min-h-[260px] lg:min-h-full rounded-2xl overflow-hidden border border-white/15 bg-[#153456]">
              {!imgError ? (
                <img
                  src="/src/assets/images/hero_folded_laundry_1795342737074.jpg"
                  alt="Neatly folded cotton towels and clean linens in a natural woven wicker basket"
                  referrerPolicy="no-referrer"
                  onError={() => setImgError(true)}
                  className="w-full h-full lg:h-full object-cover"
                />
              ) : (
                <div className="w-full h-full min-h-[280px] flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-[#16385D] to-[#0E2742]">
                  <Shirt className="w-12 h-12 text-[#EBBF4B] mb-3" aria-hidden="true" />
                  <p className="font-display font-bold text-lg text-white">
                    Freshly Washed &amp; Folded
                  </p>
                  <p className="text-sm text-white/75 mt-1">
                    From $30 / 6kg · Doorstep Pickup &amp; Delivery
                  </p>
                </div>
              )}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0E2742]/55 via-transparent to-transparent"
              />
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-xs sm:text-sm font-semibold text-white">
                <span>Wash · Dry · Fold from $30 / 6kg</span>
                <span className="text-[#EBBF4B]">Free Pickup $30+</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
