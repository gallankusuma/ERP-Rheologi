const bcrypt = require("bcrypt");
const mysql = require("mysql2/promise");

(async () => {
  const hash = await bcrypt.hash("admin123", 10);
  const conn = await mysql.createConnection({
    host: "localhost",
    user: "erp_user",
    password: "ErpSecure2024!",
    database: "erp_genjaya"
  });
  await conn.execute("UPDATE users SET password = ? WHERE id = 1", [hash]);
  console.log("Admin password updated successfully");
  await conn.end();
})();
