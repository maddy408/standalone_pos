import { Link } from 'react-router-dom';
import { Users, Wallet } from 'lucide-react';

export default function Collection() {
  return (
    <div className="space-y-6">
      {/* Internal Navigation Tabs */}
      <div className="flex items-center gap-2 pb-3 border-b border-[#DCE5EF] dark:border-[#22354B]">
        <Link
          to="/customers"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-[#5A6B82] dark:text-[#94A3B8] hover:text-[#0A4174] dark:hover:text-[#4A8CD2] hover:bg-[#E2EDF8] dark:hover:bg-[#1A2A3D] transition-colors"
        >
          <Users className="w-3.5 h-3.5" />
          <span>Customers</span>
        </Link>
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#0A4174] text-white dark:bg-[#4A8CD2] dark:text-[#0B131E] shadow-xs">
          <Wallet className="w-3.5 h-3.5" />
          <span>Collection</span>
        </span>
      </div>

      {/* Empty placeholder container - no dummy data */}
      <div className="rounded-2xl border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] p-12 text-center shadow-xs">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E2EDF8] dark:bg-[#1A2A3D] text-[#0A4174] dark:text-[#4A8CD2] mb-4">
          <Wallet className="w-7 h-7" />
        </div>
        <h2 className="text-base font-bold text-[#1C2736] dark:text-[#F1F5F9]">
          Collection
        </h2>
        <p className="mt-1 text-xs text-[#5A6B82] dark:text-[#94A3B8]">
          This module is ready for backend integration.
        </p>
      </div>
    </div>
  );
}

