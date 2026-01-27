import { createClient } from '@supabase/supabase-js';

// Safe access to environment variables
const getEnv = (key: string) => {
    // Check if process is defined (Node.js/Webpack/Vite environments)
    if (typeof process !== 'undefined' && process.env) {
        return process.env[key];
    }
    // Check if import.meta.env is defined (Vite modern environments)
    if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
        return (import.meta as any).env[key];
    }
    return undefined;
};

// URL do Projeto fornecida
const supabaseUrl = (window as any).__supabase_url || getEnv('SUPABASE_URL') || 'https://xtemzcdoitfiiczbbmeo.supabase.co';

// Chave Publicável (Anon Key) fornecida
const supabaseKey = (window as any).__supabase_key || getEnv('SUPABASE_KEY') || 'sb_publishable_yqve7l5GNym1wfyK2NqDkA_H3S2Y26h';

// NOTA DE SEGURANÇA:
// A chave secreta (service role) NÃO foi incluída no código do site por segurança.
// O site usa apenas a chave pública para interagir com o banco de dados conforme as regras de segurança (RLS) do Supabase.

export const supabase = createClient(supabaseUrl, supabaseKey);