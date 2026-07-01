"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/layout/Header";
import { formatUGX, formatDate, cn } from "@/utils";
import { Users, Plus, ChevronDown, ChevronUp } from "lucide-react";

export default function CreditPage() {
  const [balances, setBalances] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [ledger, setLedger]     = useState<any[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("vw_credit_balances")
        .select("*")
        .order("outstanding_balance_ugx", { ascending: false });
      if (data) setBalances(data);
      setLoading(false);
    };
    load();
  }, []);

  const toggleExpand = async (id: string) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    setLedgerLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("credit_account_transactions")
      .select("*").eq("credit_customer_id", id)
      .order("transaction_date", { ascending: false }).limit(50);
    if (data) setLedger(data);
    setLedgerLoading(false);
  };

  const totalOutstanding = balances.reduce((s, b) => s + (b.outstanding_balance_ugx ?? 0), 0);

  return (
    <>
      <Header title="Credit Accounts" />
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">All fleet and credit customers</p>
            {totalOutstanding > 0 && (
              <p className="text-sm font-bold text-amber-600 mt-0.5">
                Total outstanding: {formatUGX(totalOutstanding)}
              </p>
            )}
          </div>
          <Link href="/credit/new" className="btn-primary">
            <Plus size={16} /> Record Payment
          </Link>
        </div>

        {loading ? (
          <div className="card p-10 text-center text-gray-400 text-sm">Loading...</div>
        ) : balances.length === 0 ? (
          <div className="card p-12 text-center">
            <Users size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-semibold">No credit customers yet</p>
            <p className="text-sm text-gray-400 mt-1">Add credit customers in System Setup</p>
            <Link href="/setup" className="btn-primary inline-flex mt-4">Go to Setup</Link>
          </div>
        ) : (
          <div className="space-y-2">
            {balances.map((b) => {
              const utilPct = b.credit_limit_ugx > 0
                ? (b.outstanding_balance_ugx / b.credit_limit_ugx) * 100 : 0;
              const isOver = utilPct > 90;
              const isExpanded = expanded === b.credit_customer_id;
              return (
                <div key={b.credit_customer_id} className="card overflow-hidden">
                  <button onClick={() => toggleExpand(b.credit_customer_id)}
                    className="w-full px-5 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors text-left">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-gray-800">{b.customer_name}</p>
                        {isOver && <span className="badge bg-red-100 text-red-700 text-xs">Near Limit</span>}
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                          <div className={`h-1.5 rounded-full ${isOver ? "bg-red-500" : "bg-blue-500"}`}
                            style={{ width:`${Math.min(utilPct, 100)}%` }} />
                        </div>
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                          {utilPct.toFixed(0)}% of {formatUGX(b.credit_limit_ugx)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-xl font-black ${b.outstanding_balance_ugx > 0 ? "text-amber-700" : "text-green-600"}`}>
                        {formatUGX(b.outstanding_balance_ugx)}
                      </p>
                      <p className="text-xs text-gray-400">Outstanding</p>
                    </div>
                    <div className="text-gray-400 ml-2">
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-gray-100">
                      {ledgerLoading ? (
                        <div className="p-6 text-center text-gray-400 text-sm">Loading...</div>
                      ) : ledger.length === 0 ? (
                        <div className="p-6 text-center text-gray-400 text-sm">No transactions yet</div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="data-table">
                            <thead>
                              <tr><th>Date</th><th>Type</th><th>Reference</th>
                                <th className="text-right">Amount</th>
                                <th className="text-right">Balance After</th><th>By</th></tr>
                            </thead>
                            <tbody>
                              {ledger.map((tx) => (
                                <tr key={tx.id}>
                                  <td className="whitespace-nowrap">{formatDate(tx.transaction_date)}</td>
                                  <td>
                                    <span className={cn("badge text-xs",
                                      tx.entry_type === "charge"  ? "bg-amber-100 text-amber-700" :
                                      tx.entry_type === "payment" ? "bg-green-100 text-green-700" :
                                      "bg-gray-100 text-gray-600")}>
                                      {tx.entry_type}
                                    </span>
                                  </td>
                                  <td className="text-gray-400 text-xs font-mono">{tx.payment_reference ?? "—"}</td>
                                  <td className={cn("text-right font-semibold",
                                    tx.entry_type === "payment" ? "text-green-700" : "text-amber-700")}>
                                    {tx.entry_type === "payment" ? "−" : "+"}{formatUGX(tx.amount_ugx)}
                                  </td>
                                  <td className="text-right text-gray-600">
                                    {tx.balance_after_ugx != null ? formatUGX(tx.balance_after_ugx) : "—"}
                                  </td>
                                  <td className="text-gray-400 text-xs">{tx.entered_by ?? "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
                        <Link href="/credit/new" className="btn-primary btn-sm">
                          <Plus size={14} /> Record Payment from {b.customer_name}
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}