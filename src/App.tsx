import { useEffect } from "react";
import { supabase } from "./lib/supabase";

function App() {
  useEffect(() => {
    supabase
      .from("objects")
      .select("*")
      .then(({ data, error }) => {
        console.log("data:", data);
        console.log("error:", error);
      });
  }, []);

  return <h1>Mini CRM</h1>;
}

export default App;