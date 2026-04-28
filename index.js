import express from "express";
import dotenv from "dotenv";
import db from "./db.js";
dotenv.config();

const app = express();
const PORT = process.env.PORT || 9000;
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello, World!");
});

function getIp(req) {
  const forwardedIp = req.headers["x-forwarded-for"];

  if (forwardedIp) {
    return forwardedIp.split(",")[0].trim();
  }

  return req.ip;
}

function clearOldRequests() {
  const oneMinuteAgo = Date.now() - 60 * 1000;

  db.run(
    `DELETE FROM request_logs WHERE created_at < ?`,
    [oneMinuteAgo],
    (err) => {
      if (err) {
        console.log(err.message);
      }
    },
  );
}

function rateLimiter(req, res, next) {
  const userId = req.headers.userid;
  const ipAddress = getIp(req);

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: "userId header is required",
    });
  }

  clearOldRequests();

  const oneMinuteAgo = Date.now() - 60 * 1000;

  db.get(
    `
      SELECT COUNT(*) as count
      FROM request_logs
      WHERE user_id = ?
      AND created_at >= ?
    `,
    [userId, oneMinuteAgo],
    (userErr, userData) => {
      if (userErr) {
        return res.status(500).json({
          success: false,
          message: "Failed to check user limit",
        });
      }

      if (userData.count >= 5) {
        return res.status(429).json({
          success: false,
          message: "User limit exceeded",
        });
      }

      db.get(
        `
          SELECT COUNT(*) as count
          FROM request_logs
          WHERE ip_address = ?
          AND created_at >= ?
        `,
        [ipAddress, oneMinuteAgo],
        (ipErr, ipData) => {
          if (ipErr) {
            return res.status(500).json({
              success: false,
              message: "Failed to check IP limit",
            });
          }

          if (ipData.count >= 20) {
            return res.status(429).json({
              success: false,
              message: "IP limit exceeded",
            });
          }

          db.run(
            `
              INSERT INTO request_logs (user_id, ip_address, created_at)
              VALUES (?, ?, ?)
            `,
            [userId, ipAddress, Date.now()],
            (insertErr) => {
              if (insertErr) {
                return res.status(500).json({
                  success: false,
                  message: "Failed to save request",
                });
              }

              next();
            },
          );
        },
      );
    },
  );
}

app.get("/data", rateLimiter, (req, res) => {
  res.json({
    success: true,
    message: "Data fetched successfully",
    data: {
      name: "Sample Data",
    },
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
