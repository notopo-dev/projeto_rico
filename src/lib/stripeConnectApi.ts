import { supabase } from "./supabaseClient";

export interface StripeAccountStatus {
  conectado: boolean;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  onboarding_completo?: boolean;
}

/**
 * Inicia (ou retoma) o onboarding do lojista no Stripe Connect.
 * Retorna a URL para redirecionar o lojista até a Stripe.
 */
export async function iniciarStripeOnboarding(): Promise<string> {
  const { data, error } = await supabase.functions.invoke(
    "stripe-connect-onboarding"
  );

  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  return data.url as string;
}

/**
 * Consulta o status atual da conta Stripe Connect do lojista.
 */
export async function checarStatusStripe(): Promise<StripeAccountStatus> {
  const { data, error } = await supabase.functions.invoke(
    "stripe-check-account-status"
  );

  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  return data as StripeAccountStatus;
}