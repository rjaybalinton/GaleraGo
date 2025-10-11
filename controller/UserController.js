const bcrypt = require("bcrypt")
const User = require("../model/UserModel") // ✅ Make sure the path is correct
const TouristModel = require("../model/TouristModel")
const db = require("../config/db")
const multer = require("multer")
const path = require("path")
const nodemailer = require("nodemailer")

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/") // Save files in 'uploads' folder
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)) // Rename file with timestamp
  },
})

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true)
    } else {
      cb(new Error("Only image files are allowed!"), false)
    }
  },
})

const UserController = {
  // In UserController.js

  // In UserController.js - register method

  register: async (req, res) => {
    try {
      console.log("🔹 Received Registration Data:", req.body)
      console.log("🔹 Uploaded File:", req.file)
      const newUser = {
        username: req.body.username,
        first_name: req.body.first_name,
        last_name: req.body.last_name,
        contact_number: req.body.contact_number,
        email: req.body.email,
        password: req.body.password,
        date_of_birth: req.body.date_of_birth || "2000-01-01",
        gender: req.body.gender || "Other",
        nationality: req.body.nationality || "N/A",
        address: req.body.address || "N/A",
        profile_picture: req.file ? req.file.filename : "default.jpg",
      }

      const requiredFields = ["username", "first_name", "last_name", "contact_number", "email", "password"]
      const missingFields = requiredFields.filter((field) => !newUser[field])

      if (missingFields.length > 0) {
        console.error("❌ Missing required fields:", missingFields)
        req.session.error = `Missing required fields: ${missingFields.join(", ")}`
        return res.redirect("/register1")
      }

      // Check if user exists
      console.log("🔹 Checking if email exists:", newUser.email)
      const existingUser = await User.findByEmail(newUser.email)
      if (existingUser) {
        console.log("❌ Email already registered:", newUser.email)
        req.session.error = "Email is already registered."
        return res.redirect("/register1")
      }

      // Hash password
      console.log("🔹 Hashing password")
      const hashedPassword = await bcrypt.hash(newUser.password, 10)
      newUser.password = hashedPassword

      console.log("📦 Final user data before save:", newUser)

      // Save user
      try {
        console.log("🔹 Attempting to save user")
        const result = await User.createUser(newUser)
        console.log("✅ User registered successfully with ID:", result.insertId)

        req.session.success = "Registration successful! Please log in."
        return res.redirect("/userlogin")
      } catch (dbError) {
        console.error("❌ Failed to create user:", dbError)
        req.session.error = "Database error. Please try again later."
        return res.redirect("/register1")
      }
    } catch (error) {
      console.error("❌ Registration error:", error)
      console.error("❌ Error stack:", error.stack)
      req.session.error = "An unexpected error occurred. Please try again."
      return res.redirect("/register1")
    }
  },

  // UPDATED User Login with Modal Support for Suspension
  login: async (req, res) => {
    const { email, password } = req.body

    console.log("Login attempt with:", { email })
    try {
      // Check if db is properly initialized
      if (!db || !db.query) {
        console.error("❌ Database connection is not available")
        req.session.error = "Database connection error. Please try again later."
        return res.redirect("/userlogin")
      }

      try {
        // Find user by email with suspension details
        const [rows] = await db.query(
          `
                SELECT 
                    u.*,
                    admin.username as suspended_by_name,
                    admin.first_name as admin_first_name,
                    admin.last_name as admin_last_name
                FROM users u
                LEFT JOIN users admin ON u.suspended_by = admin.user_id
                WHERE u.email = ?
                `,
          [email],
        )

        console.log("Query result rows:", rows ? rows.length : "undefined")

        const user = rows[0]

        if (!user) {
          console.log("❌ No user found with email:", email)
          req.session.error = "Invalid email or password."
          return res.redirect("/userlogin")
        }

        console.log("Found user:", {
          id: user.user_id,
          email: user.email,
          type: user.user_type,
          is_suspended: user.is_suspended,
          is_suspended_type: typeof user.is_suspended,
          suspension_reason: user.suspension_reason,
          suspended_at: user.suspended_at,
          suspended_by: user.suspended_by,
        })

        // SUSPENSION CHECK - Convert to number for reliable comparison
        const suspensionStatus = Number(user.is_suspended)
        console.log("🔍 Suspension status (converted to number):", suspensionStatus)

        if (suspensionStatus === 1) {
          console.log("❌ User is suspended:", user.user_id)
          console.log("❌ Suspension details:", {
            reason: user.suspension_reason,
            suspended_at: user.suspended_at,
            suspended_by: user.suspended_by,
            suspended_by_name: user.suspended_by_name,
          })

          // Create detailed suspension data for modal
          const suspensionData = {
            title: "Account Suspended",
            message: "Your account has been suspended and you cannot log in at this time.",
            details: [],
          }

          // Add suspension date if available
          if (user.suspended_at) {
            try {
              const suspendedDate = new Date(user.suspended_at).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
              suspensionData.details.push({
                label: "Suspended On",
                value: suspendedDate,
              })
            } catch (dateError) {
              console.log("Date parsing error:", dateError)
            }
          }

          // Add who suspended the account
          if (user.suspended_by_name) {
            const adminName =
              user.admin_first_name && user.admin_last_name
                ? `${user.admin_first_name} ${user.admin_last_name}`
                : user.suspended_by_name
            suspensionData.details.push({
              label: "Suspended By",
              value: adminName,
            })
          }

          // Add suspension reason if available
          if (user.suspension_reason && user.suspension_reason.trim() !== "") {
            suspensionData.details.push({
              label: "Reason",
              value: user.suspension_reason,
            })
          }

          // Add contact information
          suspensionData.details.push({
            label: "Need Help?",
            value: "Please contact support for assistance with your account suspension.",
          })

          console.log("❌ Suspension data for modal:", suspensionData)

          // Store suspension data in session for modal display
          req.session.suspensionModal = suspensionData
          return res.redirect("/userlogin")
        }

        console.log("✅ User is not suspended, proceeding with password check")

        // Compare passwords (only if not suspended)
        console.log("Comparing password with hash...")
        const isMatch = await bcrypt.compare(password, user.password)
        console.log("Password match result:", isMatch)

        if (!isMatch) {
          console.log("❌ Passwords do not match!")
          req.session.error = "Invalid email or password."
          return res.redirect("/userlogin")
        }

        // Login successful
        console.log("✅ Login successful for user type:", user.user_type)
        // Store user data in session
        req.session.user = {
          user_id: user.user_id,
          username: user.username,
          email: user.email,
          user_type: user.user_type,
        }

        // Redirect based on user type
        console.log("Redirecting based on user type:", user.user_type)
        switch (user.user_type) {
          case "admin":
            console.log("Redirecting to admin dashboard")
            return res.redirect("/admin/dashboard")
          case "entry_provider":
            return res.redirect("/provider/entry")
          case "activity_provider":
            return res.redirect("/provider/activities")
          case "tourist":
          default:
            return res.redirect("/user/home")
        }
      } catch (dbQueryError) {
        console.error("❌ Database query error:", dbQueryError)
        req.session.error = "Database query error. Please try again later."
        return res.redirect("/userlogin")
      }
    } catch (err) {
      console.error("❌ General error:", err)
      req.session.error = "An unexpected error occurred. Please try again later."
      return res.redirect("/userlogin")
    }
  },

  // Get User by ID
  getUserById: async (req, res) => {
    const { id } = req.params
    try {
      const user = await User.getUserById(id)
      if (!user) return res.status(404).json({ error: "User not found" })
      res.json(user)
    } catch (err) {
      return res.status(500).json({ error: "Database error" })
    }
  },

  logout: (req, res) => {
    // Set cache control headers to prevent caching
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")
    res.setHeader("Pragma", "no-cache")
    res.setHeader("Expires", "0")

    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err)
        return res.status(500).send("Failed to logout. Please try again.")
      }
      res.clearCookie("connect.sid") // Remove session cookie
      res.redirect("/userlogin") // Redirect to login page
    })
  },

  // Forgot Password - Generate and Send Code
  forgotPassword: async (req, res) => {
    const { email } = req.body

    try {
      console.log("🔹 Password reset requested for email:", email)
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "Invalid email format" })
      }

      const [users] = await db.query("SELECT * FROM users WHERE email = ?", [email])

      if (!users || users.length === 0) {
        console.log("❌ Email not found:", email)
        return res.status(404).json({ message: "Email not found" })
      }

      // Check if user is suspended
      const user = users[0]
      const isSuspended =
        user.is_suspended === 1 ||
        user.is_suspended === "1" ||
        user.is_suspended === true ||
        Number.parseInt(user.is_suspended) === 1

      if (isSuspended) {
        console.log("❌ Account suspended for email:", email)
        return res.status(403).json({
          message: "Account is suspended. Please contact support for assistance.",
        })
      }

      // Generate 6-digit reset code
      const resetCode = Math.floor(100000 + Math.random() * 900000).toString()
      const expirationTime = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
      
      console.log("🔹 Generated reset code:", resetCode)
      console.log("🔹 Expiration time:", expirationTime)

      // Update database with reset code and expiry
      const [updateResult] = await db.query("UPDATE users SET reset_code = ?, reset_expiry = ? WHERE email = ?", [
        resetCode,
        expirationTime,
        email,
      ])

      if (updateResult.affectedRows === 0) {
        console.log("❌ Failed to update reset code in database")
        return res.status(500).json({ message: "Failed to generate reset code" })
      }

      console.log("✅ Reset code updated in database")

      // Check if email credentials are configured
      const emailUser = process.env.EMAIL_USER || "rjaybalinton833@gmail.com"
      const emailPass = process.env.EMAIL_PASS || "zwmi zdfr bkao ddso"
      const isRender = process.env.RENDER
      const isProduction = process.env.NODE_ENV === 'production' || isRender

      console.log("🔧 Email Configuration:")
      console.log(`  - Environment: ${isRender ? 'Render.com' : isProduction ? 'Production' : 'Development'}`)
      console.log(`  - EMAIL_USER: ${emailUser}`)
      console.log(`  - EMAIL_PASS: ${emailPass ? '***' + emailPass.slice(-4) : 'NOT SET'}`)
      console.log(`  - RENDER: ${isRender ? 'YES' : 'NO'}`)
      console.log(`  - NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`)
      
      // For development/testing, always show the code in console
      console.log("=".repeat(60))
      console.log("📧 PASSWORD RESET CODE FOR TESTING")
      console.log("=".repeat(60))
      console.log(`Email: ${email}`)
      console.log(`User: ${user.first_name} ${user.last_name}`)
      console.log(`Reset Code: ${resetCode}`)
      console.log(`Expires: ${expirationTime}`)
      console.log("=".repeat(60))
      console.log("⚠️  Use this code in the password reset form")
      console.log("=".repeat(60))
      
      // Try to send email, but don't fail if it doesn't work
      let emailSent = false
      let emailError = null

      // Try to send email
      try {
        console.log("📧 Attempting to send email...")
        console.log(`📧 Sending to: ${email}`)
        
        // Configure transporter based on environment
        const isRender = process.env.RENDER
        const isProduction = process.env.NODE_ENV === 'production' || isRender
        console.log(`🌍 Environment: ${isRender ? 'Render.com' : isProduction ? 'Production' : 'Development'}`)
        
        // Use more aggressive settings for Render.com
        const transporter = nodemailer.createTransport({
          service: "gmail",
          host: "smtp.gmail.com",
          port: isRender ? 465 : (isProduction ? 465 : 587), // Always use SSL on Render
          secure: isRender || isProduction, // true for 465, false for other ports
          auth: {
            user: emailUser,
            pass: emailPass,
          },
          // Very aggressive settings for Render.com
          connectionTimeout: isRender ? 10000 : (isProduction ? 20000 : 60000),
          greetingTimeout: isRender ? 5000 : (isProduction ? 10000 : 30000),
          socketTimeout: isRender ? 10000 : (isProduction ? 20000 : 60000),
          pool: false, // Disable pooling on Render
          maxConnections: 1,
          maxMessages: 1,
          tls: {
            rejectUnauthorized: false,
            ciphers: isRender ? 'TLSv1.2' : (isProduction ? 'TLSv1.2' : 'SSLv3'),
            minVersion: isRender ? 'TLSv1.2' : undefined
          },
          // Additional settings for cloud platforms
          requireTLS: true,
          ignoreTLS: false,
          debug: false, // Disable debug in production
          // Render.com specific settings
          ...(isRender && {
            logger: false,
            debug: false,
            pool: false,
            maxConnections: 1,
            rateDelta: 20000,
            rateLimit: 5
          })
        })

        // Verify transporter configuration
        console.log("🔍 Verifying email transporter...")
        await transporter.verify()
        console.log("✅ Email transporter verified successfully")

        const mailOptions = {
          from: {
            name: "GaleraGo GPS",
            address: emailUser
          },
          to: email,
          subject: "🔐 Password Reset Code - GaleraGo GPS",
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Password Reset</title>
            </head>
            <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f8fafc;">
              <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); padding: 30px; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">GaleraGo GPS</h1>
                  <p style="color: #e0e7ff; margin: 10px 0 0 0; font-size: 16px;">Password Reset Request</p>
                </div>
                
                <!-- Content -->
                <div style="padding: 40px 30px;">
                  <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">Hello <strong>${user.first_name || 'User'}</strong>,</p>
                  
                  <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">You have requested to reset your password for your GaleraGo GPS account. Use the code below to complete the reset process:</p>
                  
                  <!-- Reset Code Box -->
                  <div style="background-color: #f1f5f9; border: 2px dashed #3b82f6; padding: 30px; border-radius: 12px; text-align: center; margin: 30px 0;">
                    <p style="color: #64748b; font-size: 14px; margin: 0 0 10px 0; font-weight: 600;">YOUR RESET CODE</p>
                    <div style="font-size: 36px; font-weight: bold; color: #1e3a8a; letter-spacing: 8px; margin: 10px 0; font-family: 'Courier New', monospace;">${resetCode}</div>
                    <p style="color: #64748b; font-size: 12px; margin: 10px 0 0 0;">Valid for 15 minutes</p>
                  </div>
                  
                  <!-- Instructions -->
                  <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 30px 0; border-radius: 0 8px 8px 0;">
                    <h3 style="color: #92400e; margin: 0 0 15px 0; font-size: 16px;">⚠️ Important Instructions:</h3>
                    <ul style="color: #92400e; margin: 0; padding-left: 20px; line-height: 1.6;">
                      <li>Enter this code in the password reset form</li>
                      <li>This code will expire in 15 minutes</li>
                      <li>Do not share this code with anyone</li>
                      <li>If you didn't request this reset, please ignore this email</li>
                    </ul>
                  </div>
                  
                  <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0;">If you have any questions or need assistance, please contact our support team.</p>
                </div>
                
                <!-- Footer -->
                <div style="background-color: #f8fafc; padding: 20px 30px; border-top: 1px solid #e5e7eb;">
                  <p style="color: #9ca3af; font-size: 12px; margin: 0; text-align: center;">This is an automated message from GaleraGo GPS. Please do not reply to this email.</p>
                  <p style="color: #9ca3af; font-size: 12px; margin: 5px 0 0 0; text-align: center;">© ${new Date().getFullYear()} GaleraGo GPS. All rights reserved.</p>
                </div>
              </div>
            </body>
            </html>
          `,
          text: `
GaleraGo GPS - Password Reset Code

Hello ${user.first_name || 'User'},

You have requested to reset your password for your GaleraGo GPS account.

Your Reset Code: ${resetCode}

This code will expire in 15 minutes.

Important:
- Enter this code in the password reset form
- Do not share this code with anyone
- If you didn't request this reset, please ignore this email

If you have any questions, please contact our support team.

This is an automated message from GaleraGo GPS.
© ${new Date().getFullYear()} GaleraGo GPS. All rights reserved.
          `
        }

        // Send email
        console.log("📤 Sending email...")
        const emailResult = await transporter.sendMail(mailOptions)
        console.log("✅ Email sent successfully!")
        console.log(`  - Message ID: ${emailResult.messageId}`)
        console.log(`  - Response: ${emailResult.response}`)
        console.log(`  - Accepted: ${emailResult.accepted}`)
        console.log(`  - Rejected: ${emailResult.rejected}`)
        emailSent = true
      } catch (emailErr) {
        console.error("❌ Email sending failed:")
        console.error(`  - Error: ${emailErr.message}`)
        console.error(`  - Code: ${emailErr.code}`)
        console.error(`  - Command: ${emailErr.command}`)
        console.error(`  - Response: ${emailErr.response}`)
        console.error(`  - Stack: ${emailErr.stack}`)
        emailError = emailErr.message
        emailSent = false
        
        // Try alternative email configurations if first attempt fails
        if (emailErr.code === 'EAUTH' || emailErr.code === 'ECONNECTION' || emailErr.code === 'ETIMEDOUT') {
          console.log("🔄 Trying alternative email configurations...")
          
          // Try different configurations optimized for cloud hosting
          const altConfigs = [
            {
              name: "Gmail SSL (Port 465) - Cloud Optimized",
              config: {
                service: "gmail",
                host: "smtp.gmail.com",
                port: 465,
                secure: true,
                auth: { user: emailUser, pass: emailPass },
                tls: { 
                  rejectUnauthorized: false,
                  ciphers: 'TLSv1.2',
                  minVersion: 'TLSv1.2'
                },
                connectionTimeout: 15000,
                greetingTimeout: 8000,
                socketTimeout: 15000,
                pool: false,
                maxConnections: 1
              }
            },
            {
              name: "Gmail TLS (Port 587) - Cloud Optimized",
              config: {
                service: "gmail",
                host: "smtp.gmail.com",
                port: 587,
                secure: false,
                auth: { user: emailUser, pass: emailPass },
                tls: { 
                  rejectUnauthorized: false,
                  ciphers: 'TLSv1.2',
                  minVersion: 'TLSv1.2'
                },
                connectionTimeout: 15000,
                greetingTimeout: 8000,
                socketTimeout: 15000,
                pool: false,
                maxConnections: 1
              }
            },
            {
              name: "Gmail with Minimal Settings",
              config: {
                service: "gmail",
                host: "smtp.gmail.com",
                port: 465,
                secure: true,
                auth: { user: emailUser, pass: emailPass },
                tls: { rejectUnauthorized: false },
                connectionTimeout: 10000,
                greetingTimeout: 5000,
                socketTimeout: 10000
              }
            }
          ]
          
          for (const altConfig of altConfigs) {
            try {
              console.log(`🔄 Trying ${altConfig.name}...`)
              const altTransporter = nodemailer.createTransport(altConfig.config)
              
              await altTransporter.verify()
              console.log(`✅ ${altConfig.name} verified successfully`)
              
              const altResult = await altTransporter.sendMail(mailOptions)
              console.log(`✅ Email sent via ${altConfig.name}!`)
              console.log(`  - Message ID: ${altResult.messageId}`)
              emailSent = true
              emailError = null
              break // Exit loop on success
              
            } catch (altErr) {
              console.log(`❌ ${altConfig.name} failed: ${altErr.message}`)
              continue // Try next configuration
            }
          }
          
          if (!emailSent) {
            console.error("❌ All alternative email methods failed")
            
            // For Render.com, try one more approach with minimal configuration
            if (isRender) {
              console.log("🔄 Trying Render.com specific fallback...")
              try {
                const renderTransporter = nodemailer.createTransport({
                  service: "gmail",
                  host: "smtp.gmail.com",
                  port: 465,
                  secure: true,
                  auth: { user: emailUser, pass: emailPass },
                  tls: { rejectUnauthorized: false },
                  connectionTimeout: 5000,
                  greetingTimeout: 3000,
                  socketTimeout: 5000
                })
                
                const renderResult = await renderTransporter.sendMail(mailOptions)
                console.log("✅ Email sent via Render.com fallback!")
                console.log(`  - Message ID: ${renderResult.messageId}`)
                emailSent = true
                emailError = null
              } catch (renderErr) {
                console.error("❌ Render.com fallback also failed:", renderErr.message)
              }
            }
          }
        }
      }

      // Return response based on email sending status
      let responseMessage = ""
      if (emailSent) {
        responseMessage = "✅ Reset code sent to your email successfully! Please check your inbox and spam folder."
      } else {
        responseMessage = `⚠️ Reset code generated but email sending failed: ${emailError}`
        if (isRender) {
          responseMessage += "\n\n⚠️ Note: This is running on Render.com. Email delivery may be delayed or blocked by network policies."
        }
        responseMessage += `\n\nFor testing purposes, use this code: ${resetCode}`
      }
      
      res.json({ 
        message: responseMessage,
        success: true,
        debug_code: resetCode, // Always include for testing
        email_sent: emailSent,
        email_error: emailError,
        reset_code: resetCode, // Include reset code in response
        environment: isRender ? 'render' : isProduction ? 'production' : 'development'
      })
    } catch (error) {
      console.error("❌ Error in forgotPassword:", error)
      
      // Provide more specific error messages
      if (error.code === 'EAUTH') {
        return res.status(500).json({ 
          message: "Email authentication failed. Please contact support." 
        })
      } else if (error.code === 'ECONNECTION') {
        return res.status(500).json({ 
          message: "Email service connection failed. Please try again later." 
        })
      } else if (error.code === 'ETIMEDOUT') {
        return res.status(500).json({ 
          message: "Email service timeout. Please try again later." 
        })
      }
      
      res.status(500).json({ 
        message: "Internal server error. Please try again later.",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    }
  },

  verifyCode: async (req, res) => {
    const { email, code } = req.body

    try {
      console.log("🔹 Verifying reset code for email:", email)
      console.log("🔹 Code provided:", code)

      // Validate input
      if (!email || !code) {
        return res.status(400).json({ message: "Email and code are required." })
      }

      // Validate code format (6 digits)
      if (!/^\d{6}$/.test(code)) {
        return res.status(400).json({ message: "Reset code must be 6 digits." })
      }

      const [results] = await db.query("SELECT reset_code, reset_expiry, is_suspended, first_name FROM users WHERE email = ?", [
        email,
      ])

      if (!results || results.length === 0) {
        console.log("❌ User not found for email:", email)
        return res.status(404).json({ message: "User not found." })
      }

      const user = results[0]
      console.log("🔹 User found:", user.first_name)
      console.log("🔹 Stored reset code:", user.reset_code)
      console.log("🔹 Reset expiry:", user.reset_expiry)

      // Check if user is suspended
      const isSuspended =
        user.is_suspended === 1 ||
        user.is_suspended === "1" ||
        user.is_suspended === true ||
        Number.parseInt(user.is_suspended) === 1

      if (isSuspended) {
        console.log("❌ Account suspended for email:", email)
        return res.status(403).json({
          message: "Account is suspended. Please contact support for assistance.",
        })
      }

      // Check if reset code exists
      if (!user.reset_code) {
        console.log("❌ No reset code found for user")
        return res.status(400).json({ message: "No reset code found. Please request a new one." })
      }

      // Check code
      if (user.reset_code !== code) {
        console.log("❌ Invalid reset code provided")
        return res.status(400).json({ message: "Invalid reset code." })
      }

      // Check expiry
      const now = new Date()
      const expiryDate = new Date(user.reset_expiry)
      console.log("🔹 Current time:", now)
      console.log("🔹 Expiry time:", expiryDate)
      console.log("🔹 Is expired:", now > expiryDate)

      if (now > expiryDate) {
        console.log("❌ Reset code has expired")
        return res.status(400).json({ message: "Reset code has expired. Please request a new one." })
      }

      console.log("✅ Reset code verified successfully")
      res.json({ message: "Code verified successfully." })
    } catch (err) {
      console.error("❌ Error verifying code:", err)
      res.status(500).json({ message: "Server error." })
    }
  },

  resetPassword: async (req, res) => {
    const { email, newPassword } = req.body

    try {
      console.log("🔹 Resetting password for email:", email)

      // Validate input
      if (!email || !newPassword) {
        return res.status(400).json({ message: "Email and new password are required." })
      }

      // Validate password strength
      if (newPassword.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters long." })
      }

      // Check if user exists and is not suspended
      const [users] = await db.query("SELECT is_suspended, first_name FROM users WHERE email = ?", [email])

      if (!users || users.length === 0) {
        console.log("❌ User not found for email:", email)
        return res.status(404).json({ message: "User not found." })
      }

      const user = users[0]
      console.log("🔹 User found:", user.first_name)

      const isSuspended =
        user.is_suspended === 1 ||
        user.is_suspended === "1" ||
        user.is_suspended === true ||
        Number.parseInt(user.is_suspended) === 1

      if (isSuspended) {
        console.log("❌ Account suspended for email:", email)
        return res.status(403).json({
          message: "Account is suspended. Please contact support for assistance.",
        })
      }

      // Hash the new password
      const hashedPassword = await bcrypt.hash(newPassword, 10)
      console.log("🔹 Password hashed successfully")

      // Update password and clear reset fields
      const [updateResult] = await db.query("UPDATE users SET password = ?, reset_code = NULL, reset_expiry = NULL WHERE email = ?", [
        hashedPassword,
        email,
      ])

      if (updateResult.affectedRows === 0) {
        console.log("❌ Failed to update password in database")
        return res.status(500).json({ message: "Failed to reset password. Please try again." })
      }

      console.log("✅ Password reset successfully for:", email)
      res.json({ 
        message: "Password successfully reset! You can now login with your new password.",
        success: true 
      })
    } catch (error) {
      console.error("❌ Reset password error:", error)
      res.status(500).json({ 
        message: "Server error. Please try again later.",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    }
  },

  registerTourist: (req, res) => {
    console.log("🔹 Session Data:", req.session)
    console.log("🔹 User in Session:", req.session.user)

    // Check if user is authenticated
    if (!req.session.user || !req.session.user.user_id) {
      return res.status(401).json({ error: "Unauthorized: Please log in first." })
    }

    // Convert req.body to a plain object to avoid null prototype issues
    req.body = Object.assign({}, req.body)

    console.log("✅ Received Body Data:", req.body)
    console.log("✅ Uploaded File:", req.file ? req.file.filename : "No file uploaded")

    // Check if required fields exist
    const requiredFields = [
      "email",
      "phone",
      "first_name",
      "last_name",
      "age",
      "gender",
      "nationality",
      "residence",
      "arrival_date",
      "departure_date",
      "accommodation",
    ]

    const missingFields = []
    for (const field of requiredFields) {
      if (!req.body[field]) {
        missingFields.push(field)
      }
    }

    if (missingFields.length > 0) {
      console.error("❌ Missing required fields:", missingFields)
      return res.status(400).json({ error: `Missing required fields: ${missingFields.join(", ")}` })
    }

    if (!req.file) {
      console.error("❌ No file uploaded")
      return res.status(400).json({ error: "Please upload a picture" })
    }

    const picture = req.file ? req.file.filename : "default.jpg"

    const touristData = {
      user_id: req.session.user.user_id,
      email: req.body.email,
      phone: req.body.phone,
      first_name: req.body.first_name,
      last_name: req.body.last_name,
      age: req.body.age,
      gender: req.body.gender,
      nationality: req.body.nationality,
      residence: req.body.residence,
      companions_12: req.body.companions_12 || 0,
      companions_below_12: req.body.companions_below_12 || 0,
      arrival_date: req.body.arrival_date,
      departure_date: req.body.departure_date,
      picture: picture,
      accommodation: req.body.accommodation,
    }

    TouristModel.registerTourist(touristData, (err, result) => {
      if (err) {
        console.error("❌ Database Error:", err.sqlMessage || err)
        return res.status(500).json({ error: "Database error", details: err.message })
      }
      console.log("✅ Tourist Registered Successfully:", result.insertId)
      res.status(201).json({ message: "Tourist registered successfully", touristId: result.insertId })
    })
  },
}

// ✅ Correct module.exports
module.exports = UserController
module.exports.upload = upload
