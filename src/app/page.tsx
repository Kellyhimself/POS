import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold">Welcome to POS & Inventory System</h1>
      <p className="mt-4 text-xl">A POS and inventory system for multi-store wholesalers</p>
      <Link 
        href="/dashboard" 
        className="mt-8 px-6 py-3 bg-[#0ABAB5] text-white rounded-lg hover:bg-[#099C98] transition-colors duration-200"
      >
        Go to Dashboard
      </Link>
    </main>
  );
}
