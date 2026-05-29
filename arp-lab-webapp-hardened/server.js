const express = require("express");
const path = require("path");
const https = require("https");
const fs = require("fs");

const app = express();
const PORT = 3443;

// Parse HTML form data
app.use(express.urlencoded({ extended: true }));

// Parse JSON body
app.use(express.json());

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;

  console.log("HTTPS login request received:");
  console.log("Username:", username);
  console.log("Password:", password);

  if (!username || !password) {
    return res.status(400).json({
      status: "error",
      message: "Username and password are required"
    });
  }

  res.json({
    status: "success",
    message: "Login request received securely over HTTPS",
    username,
    note: "Lab demo only. Use dummy credentials."
  });
});

const sslOptions = {
  key: fs.readFileSync(path.join(__dirname, "certs", "server.key")),
  cert: fs.readFileSync(path.join(__dirname, "certs", "server.crt"))
};

https.createServer(sslOptions, app).listen(PORT, "0.0.0.0", () => {
  console.log(`HTTPS lab web app running at https://0.0.0.0:${PORT}`);
});
