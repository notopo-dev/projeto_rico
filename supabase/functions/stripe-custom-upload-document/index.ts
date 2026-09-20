// ============================================================
// stripe-custom-upload-document
// Recebe a foto do documento (RG/CNH) do lojista, envia para a
// Stripe via Files API, e anexa à verificação da pessoa/conta.
// https://docs.stripe.com/file-upload
// https://docs.stripe.com/api/persons/update#update_person-verification
// ============================================================
import Stripe from "https://esm.sh/stripe@17.4.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-12-18.acacia",
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: "Usuário inválido." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: store } = await supabase
      .from("stores")
      .select("id, stripe_account_id, stripe_tipo_pessoa")
      .eq("owner_id", user.id)
      .single();

    if (!store?.stripe_account_id) {
      return new Response(JSON.stringify({ error: "Conta Stripe não iniciada." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Espera multipart/form-data com o arquivo em "file" e o lado
    // do documento em "side" (front/back)
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const side = (formData.get("side") as string) || "front";

    if (!file) {
      return new Response(JSON.stringify({ error: "Nenhum arquivo enviado." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const buffer = new Uint8Array(await file.arrayBuffer());

    // 1. Envia o arquivo para a Stripe (Files API)
    // https://docs.stripe.com/api/files/create
    const stripeFile = await stripe.files.create({
      purpose: "identity_document",
      file: {
        data: buffer,
        name: file.name,
        type: file.type,
      },
    } as any);

    // 2. Anexa o arquivo à verificação da pessoa/conta certa
    if (store.stripe_tipo_pessoa === "company") {
      const persons = await stripe.accounts.listPersons(store.stripe_account_id, {
        relationship: { representative: true },
      });
      if (persons.data.length === 0) {
        throw new Error("Representante legal ainda não cadastrado.");
      }
      const personId = persons.data[0].id;

      const verificationDoc: Record<string, string> = {};
      verificationDoc[side === "front" ? "front" : "back"] = stripeFile.id;

      await stripe.accounts.updatePerson(store.stripe_account_id, personId, {
        verification: {
          document: verificationDoc as any,
        },
      });
    } else {
      const verificationDoc: Record<string, string> = {};
      verificationDoc[side === "front" ? "front" : "back"] = stripeFile.id;

      await stripe.accounts.update(store.stripe_account_id, {
        individual: {
          verification: {
            document: verificationDoc as any,
          },
        },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    await supabaseAdmin
      .from("stores")
      .update({ stripe_documento_enviado: true })
      .eq("id", store.id);

    return new Response(JSON.stringify({ sucesso: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Erro ao enviar documento:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro desconhecido." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});