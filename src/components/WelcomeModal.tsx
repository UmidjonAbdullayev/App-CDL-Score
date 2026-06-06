import { useState } from 'react';
import { Search, X } from 'lucide-react';
import { Confetti } from './Confetti';

interface Props {
  onClose: () => void;
}

export function WelcomeModal({ onClose }: Props) {
  const [confettiDone, setConfettiDone] = useState(false);

  return (
    <>
      <Confetti onDone={() => setConfettiDone(true)} />
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9998] p-4">
        <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full px-8 py-8 text-center">
          <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Search size={28} className="text-white" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">Welcome to CDL Score!</h2>
          <p className="text-sm text-gray-600 mb-4 leading-relaxed">
            Your account is ready. Start by purchasing search credits to evaluate CDL-A drivers.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-3 mb-5">
            <p className="text-lg font-bold text-blue-600">Ready to Search</p>
            <p className="text-xs text-blue-700 mt-1">Purchase credits to access driver profiles and scores</p>
          </div>
          <p className="text-xs text-gray-400 mb-6">
            Each search gives you a full driver profile including reliability scores, on-time rate, drug test compliance, and carrier reviews.
          </p>
          <button
            onClick={onClose}
            className="w-full bg-gray-900 text-white py-3 rounded-xl text-sm font-bold hover:bg-gray-800 transition"
          >
            Get Started
          </button>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-300 hover:text-gray-600 transition"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </>
  );
}
