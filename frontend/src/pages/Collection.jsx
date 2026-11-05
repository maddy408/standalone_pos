import { Link } from 'react-router-dom';
import { Users, Wallet } from 'lucide-react';

export default function Collection() {
  return (
    <div className="space-y-6">
      {/* Internal Navigation Tabs */}
      <div className="flex items-center gap-2 pb-3 border-b border-[#E8E3EF] dark:border-[#393244]">
        <Link
          to="/customers"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-[#716B7C] dark:text-[#B8B0C4] hover:text-[#7652B5] dark:hover:text-[#A98ADB] hover:bg-[#EDE7F7] dark:hover:bg-[#2B2536] transition-colors"
        >
          <Users className="w-3.5 h-3.5" />
          <span>Customers</span>
        </Link>
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#7652B5] text-white dark:bg-[#A98ADB] dark:text-[#17151D] shadow-xs">
          <Wallet className="w-3.5 h-3.5" />
          <span>Collection</span>
        </span>
      </div>

      {/* Empty placeholder container - no dummy data */}
      <div className="rounded-2xl border border-[#E8E3EF] dark:border-[#393244] bg-white dark:bg-[#211D2A] p-12 text-center shadow-xs">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EDE7F7] dark:bg-[#2B2536] text-[#7652B5] dark:text-[#A98ADB] mb-4">
          <Wallet className="w-7 h-7" />
        </div>
        <h2 className="text-base font-bold text-[#282431] dark:text-[#F5F2F9]">
          Collection
        </h2>
        <p className="mt-1 text-xs text-[#716B7C] dark:text-[#B8B0C4]">
          This module is ready for backend integration.
        </p>
      </div>
    </div>
  );
}

