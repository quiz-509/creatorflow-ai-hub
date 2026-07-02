import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const COMMISSION_RATE = 0.15; // 15%

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const {
      mission_id,
      amount_cents,
      mission_titre,
      success_url,
      cancel_url,
      expert_id,
    } = await req.json();

    if (!amount_cents || amount_cents < 50) {
      return new Response(JSON.stringify({ error: 'Montant invalide (minimum 0.50$).' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const commissionCents = Math.round(amount_cents * COMMISSION_RATE);

    // Chercher le compte Stripe Connect de l'expert
    let expertStripeAccountId: string | null = null;
    if (expert_id) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      const { data: profile } = await supabase
        .from('profiles')
        .select('stripe_account_id, stripe_payout_enabled')
        .eq('id', expert_id)
        .single();

      if (profile?.stripe_account_id && profile?.stripe_payout_enabled) {
        expertStripeAccountId = profile.stripe_account_id;
      }
    }

    // Construire les paramètres de session
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'cad',
          product_data: { name: mission_titre ?? 'Mission CreatorFlow Market' },
          unit_amount: amount_cents,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url,
      cancel_url,
      metadata: {
        mission_id: mission_id ?? '',
        expert_id: expert_id ?? '',
      },
    };

    // Ajouter Stripe Connect si l'expert est configuré
    if (expertStripeAccountId) {
      sessionParams.payment_intent_data = {
        application_fee_amount: commissionCents,
        transfer_data: {
          destination: expertStripeAccountId,
        },
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return new Response(JSON.stringify({
      url: session.url,
      commission_cents: commissionCents,
      expert_receives_cents: amount_cents - commissionCents,
      stripe_connect_active: !!expertStripeAccountId,
    }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
