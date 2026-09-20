import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import Login from "../pages/Login";


interface Props {
  children: React.ReactNode;
}


export default function AuthGuard({
  children
}: Props) {


  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);



  useEffect(() => {


    let mounted = true;



    async function verificarUsuario() {


      const {
        data
      } = await supabase.auth.getUser();



      if (!mounted) return;



      setUser(data.user ?? null);

      setLoading(false);


    }



    verificarUsuario();



    const {
      data: listener
    } = supabase.auth.onAuthStateChange(
      
      (_event, session) => {

        if (!mounted) return;


        setUser(
          session?.user ?? null
        );


      }

    );



    return () => {

      mounted = false;

      listener
        .subscription
        .unsubscribe();

    };


  }, []);





  if (loading) {


    return (

      <div
        className="
          min-h-screen
          flex
          items-center
          justify-center
          text-gray-500
        "
      >

        Carregando...

      </div>

    );

  }





  if (!user) {


    return <Login />;


  }





  return (

    <>
      {children}
    </>

  );


}