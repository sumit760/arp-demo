const express = require("express");
const path = require("path");

const app = express();
const PORT = 3000;

// Parse HTML form data: application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));

// Parse JSON body: application/json
app.use(express.json());

// Serve static files from public folder
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;

  console.log("Login request received:");
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
    message: "Login request received",
    username: username,
    note: "Lab demo only. Use dummy credentials."
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Lab web app running at http://0.0.0.0:${PORT}`);
});
