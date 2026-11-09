import { useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { AuthContext } from "./AuthContext";
import type { Profile } from "../types";

// Profile together with the user id it was loaded for.
// Lets us tell "not loaded yet for this user" from "loaded, but no row".
type ProfileResult = { userId: string; profile: Profile | null };

export function AuthProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);

    const [sessionLoaded, setSessionLoaded] = useState(false);

    const [profileResult, setProfileResult] = useState<ProfileResult | null>(null);

    useEffect(() => {

        async function loadSession() {
            const { data } = await supabase.auth.getSession();
            setSession(data.session);
            setSessionLoaded(true);
        }

        loadSession();
    }, []);

    const userId = session?.user.id ?? null;

    // Load the profile every time the signed-in user changes.
    useEffect(() => {
        if (!userId) return;

        // If the user changes before the answer arrives, ignore the old answer.
        let cancelled = false;

        async function loadProfile(id: string) {
            const { data } = await supabase
                .from("profiles")
                .select("id, full_name, role, created_at")
                .eq("id", id)
                .maybeSingle();

            if (!cancelled) {
                setProfileResult({ userId: id, profile: (data as Profile | null) ?? null });
            }
        }

        loadProfile(userId);

        return () => {
            cancelled = true;
        };
    }, [userId]);

    // Use the profile only if it belongs to the current user.
    const profileReady = userId !== null && profileResult?.userId === userId;
    const profile = profileReady ? profileResult.profile : null;

    // Loading until the session check is done and, if signed in, the profile request has finished.
    const loading = !sessionLoaded || (userId !== null && !profileReady);

    async function signIn(email: string, password: string): Promise<string | null> {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) return error.message;

        setSession(data.session);
        return null;
    }

    async function signOut(): Promise<void> {
        await supabase.auth.signOut();
        setSession(null);
        setProfileResult(null); // forget the old profile
    }

    return (
    // Provider — «передатчик» канала. Всё внутри него получит value через useAuth()
    <AuthContext.Provider
      value={{
        session,                  // кто вошёл
        profile,                  // имя и роль (null, если не вошёл или профиля нет)
        loading,                  // сессия и профиль ещё загружаются
        isManager: profile?.role === "manager", // true for managers
        signIn,                   // функция входа
        signOut,                  // функция выхода
      }}
    >
      {children}  {/* всё приложение (<App />) внутри канала */}
    </AuthContext.Provider>
  );
}
