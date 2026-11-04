import { redirect } from "next/navigation";

/** La pantalla inicial es el Dashboard; el Proxy envía a /login si no hay sesión. */
export default function Home() {
  redirect("/dashboard");
}
