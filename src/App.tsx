/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo, useState } from 'react';
import { FirebaseProvider } from './contexts/FirebaseContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Navbar, type AppView } from './components/Navbar';
import { Hero } from './components/Hero';
import { BookingWizard } from './components/BookingWizard';
import { ServiceShowcase } from './components/ServiceShowcase';
import { CustomerAccountPanel } from './components/CustomerAccountPanel';
import { AdminDashboard } from './components/AdminDashboard';
import { Footer } from './components/Footer';

function HelpMeWashShell() {
  const [activeView, setActiveView] = useState<AppView>('store');
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
    setActiveView('store');
    if (step) {
      setActiveStep(step);
    }
    setTimeout(() => {
      const el = document.getElementById('booking');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 40);
  }

  function handleResetBooking() {
    setQuantities({ 'wdf-6kg': 1 });
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F3EA] text-[#0E2742]">
      <Navbar
        activeView={activeView}
        totalItemsCount={totalItemsCount}
        onNavigateView={(view) => {
          setActiveView(view);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onJumpToBooking={() => handleJumpToBooking()}
      />

      <main className="flex-1">
        {activeView === 'store' && (
          <>
            <Hero onStartBooking={() => handleJumpToBooking(1)} />

            <BookingWizard
              activeStep={activeStep}
              onStepChange={setActiveStep}
              quantities={quantities}
              onUpdateQuantity={handleUpdateQuantity}
              onResetBooking={handleResetBooking}
              onOpenAccount={() => {
                setActiveView('account');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />

            <ServiceShowcase
              quantities={quantities}
              onQuickAddItem={handleQuickAddItem}
              onJumpToStep2={() => handleJumpToBooking(2)}
            />
          </>
        )}

        {activeView === 'account' && (
          <CustomerAccountPanel
            onBackToStore={() => setActiveView('store')}
            onStartBooking={() => handleJumpToBooking(1)}
          />
        )}

        {activeView === 'admin' && (
          <AdminDashboard onBackToStore={() => setActiveView('store')} />
        )}
      </main>

      <Footer
        onNavigateView={(view) => {
          setActiveView(view);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <FirebaseProvider>
        <HelpMeWashShell />
      </FirebaseProvider>
    </ErrorBoundary>
  );
}
