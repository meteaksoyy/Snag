"use client";

import { useState } from "react";

interface Listing {
  title: string;
  price: string;
  condition?: string;
  location?: string;
  platform?: string;
  image?: string;
}

interface BunqPayModalProps {
  listing: Listing;
  onClose: () => void;
  onSuccess: (paymentId: string | number) => void;
}

function parsePrice(price: string): string {
  const num = parseFloat(price.replace(/[^0-9.,]/g, "").replace(",", "."));
  return isNaN(num) ? "" : num.toFixed(2);
}

export default function BunqPayModal({ listing, onClose, onSuccess }: BunqPayModalProps) {
  const [recipientEmail, setRecipientEmail] = useState("sugardaddy@bunq.com");
  const [amount, setAmount] = useState(parsePrice(listing.price));
  const [description, setDescription] = useState(listing.title.slice(0, 50));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const [paymentId, setPaymentId] = useState<string | null>(null);

  const handlePay = async () => {
    if (!amount || !recipientEmail || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/bunq/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientEmail, amount, description, currency: "EUR" }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Payment failed");
      setPaid(true);
      setPaymentId(String(data.paymentId));
      setTimeout(() => onSuccess(data.paymentId), 1800);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.82)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md flex flex-col"
        style={{
          background: "rgba(10,10,16,0.98)",
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: "20px",
          boxShadow: "0 32px 80px rgba(0,0,0,0.75)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
              style={{ background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.28)" }}
            >
              🏦
            </div>
            <div>
              <h2 className="text-white font-bold text-sm leading-none">Pay with bunq</h2>
              <p className="text-gray-500 text-xs mt-0.5">Sandbox payment · no real money moved</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/5 text-lg leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {/* Listing summary */}
          <div
            className="flex items-center gap-3 p-3 rounded-xl"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            {listing.image && (
              <img
                src={listing.image}
                alt={listing.title}
                className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm truncate">{listing.title}</p>
              <p className="text-gray-400 text-xs mt-0.5">
                {[listing.condition, listing.location, listing.platform].filter(Boolean).join(" · ")}
              </p>
            </div>
            <span className="text-lg font-bold flex-shrink-0" style={{ color: "#60a5fa" }}>
              {listing.price}
            </span>
          </div>

          {paid ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center text-3xl"
                style={{ background: "rgba(74,222,128,0.15)", border: "2px solid rgba(74,222,128,0.4)" }}
              >
                ✓
              </div>
              <p className="text-white font-bold text-base">Payment Sent!</p>
              {paymentId && (
                <p className="text-gray-500 text-xs">Payment ID: {paymentId}</p>
              )}
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-white font-semibold text-xs">Pay to (email)</label>
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  className="text-white text-sm px-4 py-2.5 rounded-xl outline-none placeholder-gray-600"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.11)" }}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-white font-semibold text-xs">Amount (EUR)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold">€</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full text-white text-sm pl-8 pr-4 py-2.5 rounded-xl outline-none"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.11)" }}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-white font-semibold text-xs">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={140}
                  className="text-white text-sm px-4 py-2.5 rounded-xl outline-none placeholder-gray-600"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.11)" }}
                />
              </div>

              {error && <p className="text-red-400 text-xs">{error}</p>}

              <button
                onClick={handlePay}
                disabled={loading || !amount || !recipientEmail}
                className="w-full py-3 rounded-xl font-bold text-white text-sm transition-all hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: "linear-gradient(135deg, #2196f3 0%, #4ade80 180%)" }}
              >
                {loading ? (
                  <span className="animate-pulse">Processing…</span>
                ) : (
                  `Pay €${amount || "0.00"}`
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
