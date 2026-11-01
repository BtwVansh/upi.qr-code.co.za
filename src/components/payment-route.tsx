"use client";

import { useEffect, useState } from "react";
import { LoaderIcon } from "@/components/icons";
import { NotFoundView } from "@/components/not-found-view";
import { PaymentView } from "@/components/payment-view";
import { parsePaymentRoute, type PaymentRouteData } from "@/lib/payment-route";

type RouteState =
  | { status: "loading" }
  | { status: "invalid" }
  | { status: "ready"; data: PaymentRouteData };

function RouteLoading() {
  return (
    <div
      className="mx-auto flex max-w-lg flex-col items-center px-5 pb-16 pt-24 text-center"
      role="status"
      aria-live="polite"
    >
      <div className="qr-frame flex h-24 w-24 items-center justify-center">
        <LoaderIcon className="h-7 w-7 animate-spin text-[#0b0b0f]" />
      </div>
      <p className="mt-6 text-[12px] text-muted">Loading payment page…</p>
    </div>
  );
}

/**
 * Reconstructs the payment page from the browser URL.
 *
 * GitHub Pages serves the exported 404.html for `/upi-gen/pay/<upiId>`. This
 * component reads the pathname and query string directly, so no server,
 * database, local storage or navigation state is needed.
 */
export function PaymentRoute() {
  const [state, setState] = useState<RouteState>({ status: "loading" });

  useEffect(() => {
    const data = parsePaymentRoute(
      window.location.pathname,
      window.location.search,
    );

    if (data) {
      setState({ status: "ready", data });
    } else {
      setState({ status: "invalid" });
    }

    // The exported 404.html carries the static "Payment link not found" title.
    // Next.js reapplies that metadata during hydration, so keep the dynamic
    // title in sync while this route is mounted.
    const title = data
      ? "Pay using UPI · UPI Pay QR"
      : "Payment link not found · UPI Pay QR";
    const applyTitle = () => {
      if (document.title !== title) document.title = title;
    };
    applyTitle();

    const observer = new MutationObserver(applyTitle);
    observer.observe(document.head, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => observer.disconnect();
  }, []);

  if (state.status === "loading") return <RouteLoading />;
  if (state.status === "invalid") return <NotFoundView />;

  return (
    <PaymentView
      upiId={state.data.upiId}
      initialAmount={state.data.amount ?? ""}
      initialNote={state.data.note ?? ""}
    />
  );
}
