import { useState } from 'react';
import { Layers, Shirt, Plus, Check } from 'lucide-react';
import { TOPS_KNITWEAR_RATES, formatCurrency } from '../data/laundryCatalog';

interface ServiceShowcaseProps {
  quantities: Record<string, number>;
  onQuickAddItem: (itemId: string) => void;
  onJumpToStep2: () => void;
}

const WHY_REASONS = [
  {
    num: '01',
    title: 'No time to do laundry',
    desc: 'due to your busy schedule?',
  },
  {
    num: '02',
    title: 'No slots for washing and drying?',
    desc: 'Pick a 2-hour doorstep window that fits your day.',
  },
  {
    num: '03',
    title: 'No helping hands to fold',
    desc: 'your clothes after washing?',
  },
];

export function ServiceShowcase({
  quantities,
  onQuickAddItem,
  onJumpToStep2,
}: ServiceShowcaseProps) {
  const [rackError, setRackError] = useState(false);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);

  function handleQuickAdd(id: string) {
    onQuickAddItem(id);
    setJustAddedId(id);
    setTimeout(() => {
      setJustAddedId((curr) => (curr === id ? null : curr));
    }, 1400);
  }

  return (
    <section
      id="services"
      className="py-10 sm:py-14 border-t border-[#E2D9C5] bg-[#F7F3EA]"
    >
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
          {/* Left Column: WHY HELPMEWASH? + Quick Clear Convenient */}
          <div id="why-us" className="lg:col-span-6 space-y-6">
            <div>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-[#0E2742] tracking-tight">
                WHY HELPMEWASH?
              </h2>
              <p className="text-sm sm:text-base text-[#44596F] mt-1">
                A one-stop laundry solution designed around your busy schedule.
              </p>
            </div>

            <div className="space-y-3.5">
              {WHY_REASONS.map((item) => (
                <div
                  key={item.num}
                  className="bg-white rounded-2xl border border-[#E2D9C5] px-5 py-4 flex items-center gap-4"
                >
                  <div className="w-12 h-12 rounded-full bg-[#EBBF4B] text-[#0E2742] font-display font-extrabold text-lg flex items-center justify-center shrink-0 tabular-nums">
                    {item.num}
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-base text-[#0E2742]">
                      {item.title}
                    </h3>
                    <p className="text-sm text-[#44596F]">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Visual + Navy Callout Card matching the brand poster */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-stretch pt-2">
              <div className="sm:col-span-6 rounded-2xl overflow-hidden border border-[#E2D9C5] bg-white min-h-[200px]">
                {!rackError ? (
                  <img
                    src="/src/assets/images/care_garment_rack_1795342737271.jpg"
                    alt="Pressed shirts and knitwear hanging neatly on wooden hangers"
                    referrerPolicy="no-referrer"
                    onError={() => setRackError(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-[#EFE9DA]">
                    <Shirt className="w-10 h-10 text-[#0E2742] mb-2" aria-hidden="true" />
                    <p className="font-display font-bold text-sm text-[#0E2742]">
                      Crisp Hanger &amp; Fold Care
                    </p>
                  </div>
                )}
              </div>

              <div className="sm:col-span-6 bg-[#0E2742] text-white rounded-2xl p-6 flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <h3 className="font-display font-extrabold text-lg tracking-wide text-[#EBBF4B] leading-snug">
                    QUICK · CLEAR · CONVENIENT
                  </h3>
                  <div className="h-[3px] w-16 bg-[#EBBF4B] rounded-full" />
                  <p className="text-sm text-white/90 leading-relaxed">
                    A simple laundry service designed to save you time.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onJumpToStep2}
                  className="w-full px-4 py-2.5 min-h-[42px] bg-[#EBBF4B] hover:bg-[#DDA928] text-[#0E2742] font-display font-bold text-xs sm:text-sm rounded-xl transition-colors cursor-pointer"
                >
                  Select Your Clothes
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: OUR SERVICES + Exact Rate Table */}
          <div className="lg:col-span-6 space-y-5">
            <div>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-[#0E2742] tracking-tight">
                OUR SERVICES
              </h2>
              <p className="text-sm sm:text-base text-[#44596F] mt-1">
                Convenient laundry care, without the hassle.
              </p>
            </div>

            {/* Highlight Service Cards */}
            <div className="space-y-3">
              <div className="bg-white rounded-2xl border border-[#E2D9C5] px-5 py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-[#EBBF4B] text-[#0E2742] flex items-center justify-center shrink-0">
                    <Layers className="w-6 h-6" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-wider text-[#0E2742]">
                      WASH · DRY · FOLD
                    </p>
                    <p className="font-display font-extrabold text-xl sm:text-2xl text-[#0E2742] tabular-nums">
                      From $30 / 6kg
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleQuickAdd('wdf-6kg')}
                  className="px-4 py-2 min-h-[40px] rounded-xl bg-[#F7F3EA] hover:bg-[#EBBF4B] text-[#0E2742] text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  {justAddedId === 'wdf-6kg' ? 'Added 6kg' : '+ Add 6kg'}
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-[#E2D9C5] px-5 py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-[#EBBF4B] text-[#0E2742] flex items-center justify-center shrink-0">
                    <Shirt className="w-6 h-6" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-wider text-[#0E2742]">
                      IRONING
                    </p>
                    <p className="font-display font-extrabold text-xl sm:text-2xl text-[#0E2742] tabular-nums">
                      From $2.90 / item
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleQuickAdd('iron-addon')}
                  className="px-4 py-2 min-h-[40px] rounded-xl bg-[#F7F3EA] hover:bg-[#EBBF4B] text-[#0E2742] text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  {justAddedId === 'iron-addon' ? 'Added Ironing' : '+ Add Iron'}
                </button>
              </div>
            </div>

            {/* Tops & Knitwear Interactive Rate Card */}
            <div className="bg-white rounded-2xl border border-[#E2D9C5] overflow-hidden">
              <div className="px-5 py-4 flex items-center gap-4 border-b border-[#EFE9DA] bg-[#FCFBF8]">
                <div className="w-11 h-11 rounded-full bg-[#EBBF4B] text-[#0E2742] flex items-center justify-center shrink-0">
                  <Shirt className="w-5 h-5" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base text-[#0E2742]">
                    Tops &amp; Knitwear
                  </h3>
                  <p className="text-xs text-[#44596F]">
                    Professional care with clear per-item pricing. Click to add to your booking.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#0E2742] text-white text-xs font-bold uppercase tracking-wider">
                      <th scope="col" className="px-5 py-3">
                        Service
                      </th>
                      <th scope="col" className="px-4 py-3 text-right">
                        Price
                      </th>
                      <th scope="col" className="px-5 py-3 text-right">
                        Basket
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EFE9DA] text-sm">
                    {TOPS_KNITWEAR_RATES.map((row, idx) => {
                      const count = quantities[row.id] ?? 0;
                      const isJustAdded = justAddedId === row.id;
                      return (
                        <tr
                          key={row.id}
                          className={idx % 2 === 1 ? 'bg-[#FBF8F1]' : 'bg-white'}
                        >
                          <td className="px-5 py-3 font-medium text-[#0E2742]">
                            {row.service}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-[#0E2742] tabular-nums">
                            {formatCurrency(row.price)}
                          </td>
                          <td className="px-5 py-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => handleQuickAdd(row.id)}
                              className={`inline-flex items-center gap-1 px-3 py-1.5 min-h-[34px] rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                                isJustAdded
                                  ? 'bg-[#0E2742] text-[#EBBF4B]'
                                  : 'bg-[#F7F3EA] hover:bg-[#EBBF4B] text-[#0E2742]'
                              }`}
                            >
                              {isJustAdded ? (
                                <>
                                  <Check className="w-3.5 h-3.5" aria-hidden="true" />
                                  <span>Added</span>
                                </>
                              ) : (
                                <>
                                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                                  <span>{count > 0 ? `Add (${count})` : 'Add'}</span>
                                </>
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
