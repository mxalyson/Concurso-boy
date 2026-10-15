// Promove um usuário a administrador. Uso: npm run admin -- email@exemplo.com
import { db } from "../src/lib/db";

const email = process.argv[2];
if (!email) {
  console.log("Uso: npm run admin -- email@exemplo.com");
  process.exit(1);
}
const r = db().prepare("UPDATE usuarios SET papel = 'admin' WHERE email = ?").run(email);
console.log(r.changes ? `${email} agora é administrador.` : `Usuário ${email} não encontrado.`);
