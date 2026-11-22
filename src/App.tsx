/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo, useState } from 'react';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { BookingWizard } from './components/BookingWizard';
import { ServiceShowcase } from './components/ServiceShowcase';
import { Footer } from './components/Footer';

export default function App() {
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);
  const [quantities, setQuantities] = useState<Record<string, number>>({
    'wdf-6kg': 1,
  });

  const totalItemsCount = useMemo(
    () => Object.values(quantities).reduce((sum, count) => sum + count, 0),
    [quantities]
  );

  function handleUpdateQuantity(itemId: string, delta: number) {
    setQuantities((prev) => {
      const nextCount = Math.max(0, (prev[itemId] ?? 0) + delta);
      if (nextCount === 0) {
        const updated = { ...prev };
        delete updated[itemId];
        return updated;
      }
      return { ...prev, [itemId]: nextCount };
    });
  }

  function handleQuickAddItem(itemId: string) {
    handleUpdateQuantity(itemId, 1);
  }

  function handleJumpToBooking(step?: 1 | 2 | 3) {
    if (step) {
      setActiveStep(step);
    }
    const el = document.getElementById('booking');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function handleResetBooking() {
    setQuantities({ 'wdf-6kg': 1 });
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F3EA] text-[#0E2742]">
      <Navbar
        totalItemsCount={totalItemsCount}
        onJumpToBooking={() => handleJumpToBooking()}
      />

      <main className="flex-1">
        <Hero onStartBooking={() => handleJumpToBooking(1)} />

        <BookingWizard
          activeStep={activeStep}
          onStepChange={setActiveStep}
          quantities={quantities}
          onUpdateQuantity={handleUpdateQuantity}
          onResetBooking={handleResetBooking}
        />

        <ServiceShowcase
          quantities={quantities}
          onQuickAddItem={handleQuickAddItem}
          onJumpToStep2={() => handleJumpToBooking(2)}
        />
      </main>

      <Footer />
    </div>
  );
}
