/**
 * Compatibilidade: vários arquivos importam de "../lib/supabase".
 * Para não existir mais de um cliente na mesma página, este
 * arquivo apenas reexporta o cliente único de supabaseClient.ts.
 */
export { supabase } from "./supabaseClient";