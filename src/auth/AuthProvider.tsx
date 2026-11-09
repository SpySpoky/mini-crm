import { useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js"; 
import { supabase } from "../lib/supabase";
import { AuthContext } from "./AuthContext";


export function AuthProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);

    const [sessionLoaded, setSessionLoaded] = useState(false);

    useEffect(() => {

        async function loadSession() {
            const { data } = await supabase.auth.getSession();
            setSession(data.session);
            setSessionLoaded(true);
        }

        loadSession();
    }, []);

    async function signIn(email: string, password: string): Promise<string | null> {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) return error.message;

        setSession(data.session);
        return null;
    }

    async function signOut(): Promise<void> {
        await supabase.auth.signOut();
        setSession(null);
    }

    return (
    // Provider — «передатчик» канала. Всё внутри него получит value через useAuth()
    <AuthContext.Provider
      value={{
        session,                  // кто вошёл
        profile: null,            // имя и роль
        loading: !sessionLoaded,  // пока Supabase не ответил — идёт загрузка
        signIn,                   // функция входа
        signOut,                  // функция выхода
      }}
    >
      {children}  {/* всё приложение (<App />) внутри канала */}
    </AuthContext.Provider>
  );
}