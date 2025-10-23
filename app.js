// Load environment variables
require('env').config();

const express = require("express")
const session = require("express-session")
const path = require("path")
const mysql = require("mysql2/promise")
const routes = require("./routes/router")
const multer = require("multer")
const db = require("./config/db")
const adminRoutes = require("./routes/adminRoutes")
const touristRoutes = require("./routes/touristRoutes")
const bookingsRouter = require("./routes/bookings")
const providerRoutes = require("./routes/providerRoutes")
const reviewRoutes = require("./routes/reviewRoutes") // Add this line
const ensureLoggedIn = require('./middleware/sessionAuth');
const { router: gmailRoutes } = require('./middleware/gmailAuth');
const app = express()
const cors = require("cors")

// Setup Multer
const upload = multer({ dest: "uploads/" })

// View Engine
app.set("view engine", "ejs")

// Body Parsers
app.use(express.urlencoded({ extended: true }))
app.use(express.json())

// Sessions - Updated for production
app.use(
  session({
    secret: process.env.SESSION_SECRET || "your-very-secure-secret-key-change-this",
    resave: false,
    saveUninitialized: false, // Changed to false for security
    cookie: { 
      secure: process.env.NODE_ENV === 'production', // true in production
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      httpOnly: true, // Added for security
      sameSite: 'lax' // Added for security
    },
  }),
)
app.use('/videos', express.static(path.join(__dirname, 'videos')));
app.use(express.static("uploads"))
app.use(express.static("public"))
app.use("/uploads", express.static(path.join(__dirname, "uploads")))
app.use(cors())

// Routes (in proper order)
app.use("/",reviewRoutes) // Add review routes (includes both /api and page routes)
app.use("/api", bookingsRouter) // This handles /api/bookings/* routes
app.use("/", routes)
app.use("/admin", adminRoutes)
app.use("/provider", providerRoutes)
app.use("/", touristRoutes)
app.use("/", gmailRoutes) // Gmail OAuth2 routes
app.use('/admin', ensureLoggedIn);

// Start Server
const PORT = process.env.PORT || 3233
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
  console.log("Routes registered:")
  console.log("- Review routes: /api/reviews/* and /review/*")
  console.log("- Bookings routes: /api/bookings/*")
  console.log("- Main routes: /")
  console.log("- Admin routes: /admin/*")
  console.log("- Provider routes: /provider/*")
  console.log("- Tourist routes: /")
})

