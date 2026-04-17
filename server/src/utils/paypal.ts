import axios from "axios";

const MODE = process.env.PAYPAL_MODE ?? "sandbox";
const CLIENT_ID = process.env.PAYPAL_CLIENT_ID!;
const CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET!;

export const PAYPAL_BASE =
  MODE === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

/** Fetch a short-lived Bearer token from PayPal. */
export async function getAccessToken(): Promise<string> {
  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");

  const res = await axios.post<{ access_token: string }>(
    `${PAYPAL_BASE}/v1/oauth2/token`,
    "grant_type=client_credentials",
    {
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  return res.data.access_token;
}

export interface CreateOrderParams {
  amount: number;       // USD, 2 decimal places
  currency?: string;    // default "USD"
  description?: string;
  returnUrl: string;    // deep-link back into the app on success
  cancelUrl: string;    // deep-link back into the app on cancel
}

export interface PayPalOrder {
  id: string;
  status: string;
  /** The URL the payer must visit to approve the payment. */
  approveUrl: string;
}

/** Create a PayPal Orders v2 order and return the orderId + approveUrl. */
export async function createOrder(params: CreateOrderParams): Promise<PayPalOrder> {
  const token = await getAccessToken();

  const body = {
    intent: "CAPTURE",
    purchase_units: [
      {
        amount: {
          currency_code: params.currency ?? "USD",
          value: params.amount.toFixed(2),
        },
        description: params.description ?? "Telemedicine consultation",
      },
    ],
    application_context: {
      brand_name: "Arogyam",
      landing_page: "LOGIN",
      user_action: "PAY_NOW",
      return_url: params.returnUrl,
      cancel_url: params.cancelUrl,
    },
  };

  const res = await axios.post<{
    id: string;
    status: string;
    links: Array<{ href: string; rel: string }>;
  }>(`${PAYPAL_BASE}/v2/checkout/orders`, body, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const approveLink = res.data.links.find((l) => l.rel === "approve");
  if (!approveLink) throw new Error("PayPal did not return an approve URL");

  return {
    id: res.data.id,
    status: res.data.status,
    approveUrl: approveLink.href,
  };
}

export interface CaptureResult {
  orderId: string;
  captureId: string;
  status: string; // "COMPLETED" on success
  amount: string;
  currency: string;
}

/** Capture (complete) a PayPal order that the payer has already approved. */
export async function captureOrder(orderId: string): Promise<CaptureResult> {
  const token = await getAccessToken();

  const res = await axios.post<{
    id: string;
    status: string;
    purchase_units: Array<{
      payments: {
        captures: Array<{
          id: string;
          status: string;
          amount: { value: string; currency_code: string };
        }>;
      };
    }>;
  }>(
    `${PAYPAL_BASE}/v2/checkout/orders/${orderId}/capture`,
    {},
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  const capture = res.data.purchase_units?.[0]?.payments?.captures?.[0];
  if (!capture) throw new Error("No capture record in PayPal response");

  return {
    orderId: res.data.id,
    captureId: capture.id,
    status: capture.status,
    amount: capture.amount.value,
    currency: capture.amount.currency_code,
  };
}
