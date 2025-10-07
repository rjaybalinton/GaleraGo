const db = require("../config/db")

const ReviewController = {
 // Get comprehensive review statistics (for the new dashboard)
  getReviewStatistics: async (req, res) => {
    try {
      console.log("🔹 Fetching review statistics...");

      const [statsResult] = await db.query(`
        SELECT 
          COUNT(*) as total_reviews,
          AVG(rating) as average_rating,
          COUNT(CASE WHEN rating = 5 THEN 1 END) as five_star,
          COUNT(CASE WHEN rating = 4 THEN 1 END) as four_star,
          COUNT(CASE WHEN rating = 3 THEN 1 END) as three_star,
          COUNT(CASE WHEN rating = 2 THEN 1 END) as two_star,
          COUNT(CASE WHEN rating = 1 THEN 1 END) as one_star
        FROM reviews
      `);

      const stats = statsResult[0];

      const reviewStatistics = {
        totalReviews: parseInt(stats.total_reviews) || 0,
        averageRating: parseFloat(stats.average_rating) || 0,
        ratingBreakdown: {
          5: parseInt(stats.five_star) || 0,
          4: parseInt(stats.four_star) || 0,
          3: parseInt(stats.three_star) || 0,
          2: parseInt(stats.two_star) || 0,
          1: parseInt(stats.one_star) || 0,
        },
      };

      console.log("✅ Review statistics calculated:", reviewStatistics);
      res.json(reviewStatistics);
    } catch (error) {
      console.error("❌ Error fetching review statistics:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch review statistics",
        error: error.message,
      });
    }
  },

  // Get recent reviews (for the new dashboard)
  getRecentReviews: async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 6;
      console.log(`🔹 Fetching ${limit} recent reviews...`);

      const [reviews] = await db.query(
        `
        SELECT 
          r.*,
          u.first_name,
          u.last_name,
          p.name as package_name,
          p.activity_type,
          r.created_at as review_date
        FROM reviews r
        JOIN users u ON r.user_id = u.user_id
        JOIN packages p ON r.package_id = p.id
        ORDER BY r.created_at DESC
        LIMIT ?
      `,
        [limit]
      );

      console.log(`✅ Found ${reviews.length} recent reviews`);
      res.json(reviews);
    } catch (error) {
      console.error("❌ Error fetching recent reviews:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch recent reviews",
        error: error.message,
      });
    }
  },
 
 
    // Create a new review
  createReview: async (req, res) => {
    try {
      console.log("🔹 Creating review with data:", req.body)
      console.log("🔹 User session:", req.session.user)

      const { booking_id, package_id, rating, comment } = req.body

      // Check if user is authenticated
      if (!req.session.user || !req.session.user.user_id) {
        console.log("❌ Unauthorized review attempt")
        return res.status(401).json({
          success: false,
          message: "Unauthorized: Please log in first.",
        })
      }

      const user_id = req.session.user.user_id

      // Validate required fields
      if (!booking_id || !rating) {
        console.log("❌ Missing required fields")
        return res.status(400).json({
          success: false,
          message: "Booking ID and rating are required",
        })
      }

      // Validate rating range
      if (rating < 1 || rating > 5) {
        console.log("❌ Invalid rating range:", rating)
        return res.status(400).json({
          success: false,
          message: "Rating must be between 1 and 5",
        })
      }

      // Check if user can review this booking
      console.log("🔹 Checking if user can review booking:", booking_id)
      const [bookingCheck] = await db.query(
        `SELECT b.*, p.id as package_id 
         FROM bookings b 
         JOIN packages p ON b.package_id = p.id 
         WHERE b.id = ? AND b.user_id = ? AND b.status = "completed"`,
        [booking_id, user_id],
      )

      if (bookingCheck.length === 0) {
        console.log("❌ User cannot review this booking")
        return res.status(403).json({
          success: false,
          message: "You can only review your own completed bookings",
        })
      }

      const booking = bookingCheck[0]
      const reviewPackageId = package_id || booking.package_id

      // Check if review already exists
      console.log("🔹 Checking for existing review")
      const [existingReview] = await db.query("SELECT * FROM reviews WHERE booking_id = ?", [booking_id])

      if (existingReview.length > 0) {
        console.log("❌ Review already exists for booking:", booking_id)
        return res.status(400).json({
          success: false,
          message: "You have already reviewed this booking",
        })
      }

      // Create the review
      console.log("🔹 Creating review in database")
      const [result] = await db.query(
        `INSERT INTO reviews (booking_id, user_id, package_id, rating, comment, created_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [booking_id, user_id, reviewPackageId, rating, comment || ""],
      )

      console.log("✅ Review created successfully with ID:", result.insertId)
      res.json({
        success: true,
        message: "Review submitted successfully",
        review_id: result.insertId,
      })
    } catch (error) {
      console.error("❌ Error creating review:", error)
      console.error("❌ Error stack:", error.stack)
      res.status(500).json({
        success: false,
        message: "Failed to submit review",
      })
    }
  },

  // Get reviews for a package
  getPackageReviews: async (req, res) => {
    try {
      console.log("🔹 Getting reviews for package:", req.params.packageId)
      const { packageId } = req.params
      const { rating } = req.query // Optional filter by rating

      // Get reviews for the package
      let query = `SELECT r.*, u.first_name, u.last_name, r.created_at as review_date
                   FROM reviews r
                   JOIN users u ON r.user_id = u.user_id
                   WHERE r.package_id = ?`
      const queryParams = [packageId]

      // Filter by rating if specified
      if (rating && rating !== "all") {
        query += ` AND r.rating = ?`
        queryParams.push(Number.parseInt(rating))
      }

      query += ` ORDER BY r.created_at DESC`

      const [reviews] = await db.query(query, queryParams)

      // Get package statistics
      const [stats] = await db.query(
        `SELECT 
          COUNT(*) as review_count,
          AVG(rating) as average_rating,
          COUNT(CASE WHEN rating = 5 THEN 1 END) as five_star,
          COUNT(CASE WHEN rating = 4 THEN 1 END) as four_star,
          COUNT(CASE WHEN rating = 3 THEN 1 END) as three_star,
          COUNT(CASE WHEN rating = 2 THEN 1 END) as two_star,
          COUNT(CASE WHEN rating = 1 THEN 1 END) as one_star
         FROM reviews 
         WHERE package_id = ?`,
        [packageId],
      )

      const packageStats = stats[0]

      console.log("✅ Retrieved", reviews.length, "reviews for package:", packageId)
      res.json({
        success: true,
        reviews,
        stats: {
          total_reviews: packageStats.review_count,
          average_rating: Number.parseFloat(packageStats.average_rating || 0).toFixed(1),
          rating_breakdown: {
            5: packageStats.five_star,
            4: packageStats.four_star,
            3: packageStats.three_star,
            2: packageStats.two_star,
            1: packageStats.one_star,
          },
        },
      })
    } catch (error) {
      console.error("❌ Error fetching reviews:", error)
      res.status(500).json({
        success: false,
        message: "Failed to fetch reviews",
      })
    }
  },

  // Get user's reviews
  getUserReviews: async (req, res) => {
    try {
      if (!req.session.user || !req.session.user.user_id) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized: Please log in first.",
        })
      }

      const user_id = req.session.user.user_id
      console.log("🔹 Getting reviews for user:", user_id)

      const [reviews] = await db.query(
        `SELECT r.*, p.name as package_name, p.activity_type
         FROM reviews r
         JOIN packages p ON r.package_id = p.id
         WHERE r.user_id = ?
         ORDER BY r.created_at DESC`,
        [user_id],
      )

      console.log("✅ Retrieved", reviews.length, "reviews for user:", user_id)
      res.json({
        success: true,
        reviews,
      })
    } catch (error) {
      console.error("❌ Error fetching user reviews:", error)
      res.status(500).json({
        success: false,
        message: "Failed to fetch your reviews",
      })
    }
  },

  // Update a review
  updateReview: async (req, res) => {
    try {
      if (!req.session.user || !req.session.user.user_id) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized: Please log in first.",
        })
      }

      const { reviewId } = req.params
      const { rating, comment } = req.body
      const user_id = req.session.user.user_id

      console.log("🔹 Updating review:", reviewId, "for user:", user_id)

      // Validate rating
      if (rating && (rating < 1 || rating > 5)) {
        return res.status(400).json({
          success: false,
          message: "Rating must be between 1 and 5",
        })
      }

      // Build dynamic update query
      let query = "UPDATE reviews SET updated_at = NOW()"
      const queryParams = []

      if (rating !== undefined) {
        query += ", rating = ?"
        queryParams.push(rating)
      }

      if (comment !== undefined) {
        query += ", comment = ?"
        queryParams.push(comment)
      }

      query += " WHERE id = ? AND user_id = ?"
      queryParams.push(reviewId, user_id)

      const [result] = await db.query(query, queryParams)

      if (result.affectedRows === 0) {
        console.log("❌ Review not found or unauthorized:", reviewId)
        return res.status(404).json({
          success: false,
          message: "Review not found or you do not have permission to update it",
        })
      }

      console.log("✅ Review updated successfully:", reviewId)
      res.json({
        success: true,
        message: "Review updated successfully",
      })
    } catch (error) {
      console.error("❌ Error updating review:", error)
      res.status(500).json({
        success: false,
        message: "Failed to update review",
      })
    }
  },

  // Delete a review
  deleteReview: async (req, res) => {
    try {
      if (!req.session.user || !req.session.user.user_id) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized: Please log in first.",
        })
      }

      const { reviewId } = req.params
      const user_id = req.session.user.user_id

      console.log("🔹 Deleting review:", reviewId, "for user:", user_id)

      const [result] = await db.query("DELETE FROM reviews WHERE id = ? AND user_id = ?", [reviewId, user_id])

      if (result.affectedRows === 0) {
        console.log("❌ Review not found or unauthorized:", reviewId)
        return res.status(404).json({
          success: false,
          message: "Review not found or you do not have permission to delete it",
        })
      }

      console.log("✅ Review deleted successfully:", reviewId)
      res.json({
        success: true,
        message: "Review deleted successfully",
      })
    } catch (error) {
      console.error("❌ Error deleting review:", error)
      res.status(500).json({
        success: false,
        message: "Failed to delete review",
      })
    }
  },

  // Get packages with review statistics (for admin/provider dashboard)
  getPackagesWithStats: async (req, res) => {
    try {
      if (!req.session.user || !req.session.user.user_id) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized: Please log in first.",
        })
      }

      console.log("🔹 Getting packages with stats for user:", req.session.user.user_id)

      const [packages] = await db.query(`
        SELECT p.*, 
               COALESCE(r.review_count, 0) AS review_count,
               COALESCE(r.average_rating, 0) AS average_rating
        FROM packages p
        LEFT JOIN (
            SELECT package_id, 
                   COUNT(*) AS review_count,
                   AVG(rating) AS average_rating
            FROM reviews 
            GROUP BY package_id
        ) r ON p.id = r.package_id
        ORDER BY p.created_at DESC
      `)

      console.log("✅ Retrieved", packages.length, "packages with stats")
      res.json({
        success: true,
        packages,
      })
    } catch (error) {
      console.error("❌ Error fetching packages with stats:", error)
      res.status(500).json({
        success: false,
        message: "Failed to fetch packages with statistics",
      })
    }
  },

  // Get review statistics for admin dashboard
  getReviewStats: async (req, res) => {
    try {
      if (!req.session.user || req.session.user.user_type !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Unauthorized: Admin access required",
        })
      }

      // Get overall review statistics
      const [overallStats] = await db.query(`
        SELECT 
          COUNT(*) as total_reviews,
          AVG(rating) as average_rating,
          COUNT(CASE WHEN rating = 5 THEN 1 END) as five_star_count,
          COUNT(CASE WHEN rating = 4 THEN 1 END) as four_star_count,
          COUNT(CASE WHEN rating = 3 THEN 1 END) as three_star_count,
          COUNT(CASE WHEN rating = 2 THEN 1 END) as two_star_count,
          COUNT(CASE WHEN rating = 1 THEN 1 END) as one_star_count
        FROM reviews
      `)

      // Get reviews by month
      const [monthlyStats] = await db.query(`
        SELECT 
          DATE_FORMAT(created_at, '%Y-%m') as month_year,
          DATE_FORMAT(created_at, '%b %Y') as month,
          COUNT(*) as review_count,
          AVG(rating) as average_rating
        FROM reviews
        GROUP BY month_year
        ORDER BY month_year DESC
        LIMIT 12
      `)

      // Get top rated packages
      const [topPackages] = await db.query(`
        SELECT 
          p.name,
          p.activity_type,
          COUNT(r.id) as review_count,
          AVG(r.rating) as average_rating
        FROM packages p
        LEFT JOIN reviews r ON p.id = r.package_id
        GROUP BY p.id, p.name, p.activity_type
        HAVING review_count > 0
        ORDER BY average_rating DESC, review_count DESC
        LIMIT 10
      `)

      res.json({
        success: true,
        overall: overallStats[0],
        monthly: monthlyStats,
        topPackages: topPackages,
      })
    } catch (error) {
      console.error("❌ Error fetching review stats:", error)
      res.status(500).json({
        success: false,
        message: "Failed to fetch review statistics",
      })
    }
  },

  // Get user's bookings (integrated into ReviewController)
  getUserBookings: async (req, res) => {
    try {
      console.log("🔹 Getting bookings for user session:", req.session.user)

      if (!req.session.user || !req.session.user.user_id) {
        console.log("❌ No user session found")
        return res.status(401).json({ error: "Please log in to view your bookings" })
      }

      const userId = req.session.user.user_id
      console.log("🔹 Fetching bookings for user ID:", userId)

      const [bookings] = await db.query(
        `
              SELECT 
                  b.*,
                  p.name as package_name,
                  p.activity_type,
                  p.price as package_price,
                  pu.contact_number AS provider_contact,
                  pu.contact_number AS provider_phone,
                  pu.email AS provider_email,
                  pu.gcash_number AS provider_gcash_number,
                  pu.gcash_name AS provider_gcash_name,
                  pu.first_name AS provider_first_name,
                  pu.last_name AS provider_last_name,
                  CONCAT(pu.first_name, ' ', pu.last_name) AS provider_name
              FROM bookings b
              JOIN packages p ON b.package_id = p.id
              LEFT JOIN users pu ON p.created_by = pu.user_id
              WHERE b.user_id = ?
              ORDER BY b.created_at DESC
          `,
        [userId],
      )

      console.log("✅ Found", bookings.length, "bookings for user:", userId)
      res.json(bookings)
    } catch (error) {
      console.error("❌ Error fetching user bookings:", error)
      res.status(500).json({ error: "Failed to fetch bookings" })
    }
  },

  // Get user's bookings with ratings (enhanced version)
  getUserBookingsWithRatings: async (req, res) => {
    try {
      console.log("🔹 Getting bookings with ratings for user session:", req.session.user)

      if (!req.session.user || !req.session.user.user_id) {
        console.log("❌ No user session found")
        return res.status(401).json({ error: "Please log in to view your bookings" })
      }

      const userId = req.session.user.user_id
      console.log("🔹 Fetching bookings with ratings for user ID:", userId)

      const [bookings] = await db.query(
        `
            SELECT 
                b.*,
                p.name as package_name,
                p.activity_type,
                p.price as package_price,
                p.duration,
                p.max_participants,
                -- Provider contact information
                pu.contact_number AS provider_contact,
                pu.contact_number AS provider_phone,
                pu.email AS provider_email,
                pu.gcash_number AS provider_gcash_number,
                pu.gcash_name AS provider_gcash_name,
                pu.first_name AS provider_first_name,
                pu.last_name AS provider_last_name,
                CONCAT(pu.first_name, ' ', pu.last_name) AS provider_name,
                -- Package-level rating statistics
                COALESCE(pkg_stats.review_count, 0) as package_total_reviews,
                COALESCE(ROUND(pkg_stats.average_rating, 1), 0) as package_average_rating,
                COALESCE(pkg_stats.total_rating_sum, 0) as package_total_rating_sum,
                -- Individual booking review status
                CASE WHEN user_review.id IS NOT NULL THEN 1 ELSE 0 END as has_user_reviewed,
                user_review.rating as user_rating,
                user_review.comment as user_comment,
                user_review.created_at as user_review_date
            FROM bookings b
            JOIN packages p ON b.package_id = p.id
            LEFT JOIN users pu ON p.created_by = pu.user_id
            -- Package-level statistics
            LEFT JOIN (
                SELECT 
                    package_id,
                    COUNT(*) as review_count,
                    AVG(rating) as average_rating,
                    SUM(rating) as total_rating_sum
                FROM reviews
                GROUP BY package_id
            ) pkg_stats ON p.id = pkg_stats.package_id
            -- User's own review for this specific booking
            LEFT JOIN reviews user_review ON b.id = user_review.booking_id AND user_review.user_id = ?
            WHERE b.user_id = ?
            ORDER BY b.created_at DESC
        `,
        [userId, userId],
      )

      console.log("✅ Found", bookings.length, "bookings with enhanced ratings for user:", userId)
      res.json(bookings)
    } catch (error) {
      console.error("❌ Error fetching user bookings with ratings:", error)
      res.status(500).json({ error: "Failed to fetch bookings" })
    }
  },

  // Create a new booking (integrated into ReviewController)
  createBooking: async (req, res) => {
    try {
      console.log("🔹 Creating booking with data:", req.body)

      if (!req.session.user || !req.session.user.user_id) {
        return res.status(401).json({ error: "Please log in to make a booking" })
      }

      const {
        package_id,
        booking_date,
        number_of_participants,
        total_amount,
        contact_number,
        emergency_contact,
        emergency_phone,
        special_requests,
        payment_method,
      } = req.body

      const user_id = req.session.user.user_id

      // Validate required fields
      if (!package_id || !booking_date || !number_of_participants || !total_amount || !contact_number || !payment_method) {
        return res.status(400).json({
          error:
            "Missing required fields: package_id, booking_date, number_of_participants, total_amount, contact_number, payment_method",
        })
      }

      // Validate payment method
      if (!['cash', 'gcash'].includes(payment_method)) {
        return res.status(400).json({
          error: "Invalid payment method. Must be 'cash' or 'gcash'",
        })
      }

      // Generate unique booking reference
      const generateBookingReference = () => {
        const prefix = "GG" // GaleraGo prefix
        const timestamp = Date.now().toString().slice(-6) // Last 6 digits of timestamp
        const random = Math.random().toString(36).substr(2, 4).toUpperCase() // 4 random chars
        return `${prefix}${timestamp}${random}`
      }

      // Generate payment reference for online payments
      const generatePaymentReference = () => {
        const prefix = "PAY"
        const timestamp = Date.now().toString().slice(-6) // Last 6 digits of timestamp
        const random = Math.random().toString(36).substr(2, 4).toUpperCase() // 4 random chars
        return `${prefix}${timestamp}${random}`
      }

      const booking_reference = generateBookingReference()
      const payment_reference = payment_method === 'gcash' ? generatePaymentReference() : null

      // Get tourist_id for this user
      const [touristRows] = await db.query(
        'SELECT tourist_id FROM tourists WHERE user_id = ? LIMIT 1',
        [user_id]
      );
      
      if (touristRows.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Tourist profile not found. Please complete your profile first.'
        });
      }
      
      const tourist_id = touristRows[0].tourist_id;

      // Create the booking
      const [result] = await db.query(
        `INSERT INTO bookings 
               (user_id, tourist_id, package_id, booking_date, number_of_participants, total_amount, 
                contact_number, emergency_contact, emergency_phone, special_requests, 
                payment_method, payment_reference, booking_reference, status, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
        [
          user_id,
          tourist_id,
          package_id,
          booking_date,
          number_of_participants,
          total_amount,
          contact_number,
          emergency_contact || null,
          emergency_phone || null,
          special_requests || null,
          payment_method,
          payment_reference,
          booking_reference,
        ],
      )

      console.log("✅ Booking created successfully with ID:", result.insertId)
      res.json({
        success: true,
        message: "Booking created successfully",
        booking_id: result.insertId,
        booking_reference: booking_reference,
        payment_reference: payment_reference,
      })
    } catch (error) {
      console.error("❌ Error creating booking:", error)
      res.status(500).json({ error: "Failed to create booking" })
    }
  },

  // Cancel a booking (integrated into ReviewController)
  cancelBooking: async (req, res) => {
    try {
      const { bookingId } = req.params
      const { cancellation_reason } = req.body

      if (!req.session.user || !req.session.user.user_id) {
        return res.status(401).json({ error: "Please log in to cancel booking" })
      }

      if (!cancellation_reason || !cancellation_reason.trim()) {
        return res.status(400).json({ error: "Cancellation reason is required" })
      }

      const userId = req.session.user.user_id
      console.log("🔹 Cancelling booking:", bookingId, "for user:", userId)

      const [result] = await db.query(
        `UPDATE bookings 
               SET status = 'cancelled', 
                   cancellation_reason = ?, 
                   cancelled_at = NOW(),
                   updated_at = NOW()
               WHERE id = ? AND user_id = ? AND status = 'pending'`,
        [cancellation_reason.trim(), bookingId, userId],
      )

      if (result.affectedRows === 0) {
        return res.status(404).json({
          error: "Booking not found or cannot be cancelled (only pending bookings can be cancelled)",
        })
      }

      console.log("✅ Booking cancelled successfully:", bookingId)
      res.json({
        success: true,
        message: "Booking cancelled successfully",
      })
    } catch (error) {
      console.error("❌ Error cancelling booking:", error)
      res.status(500).json({ error: "Failed to cancel booking" })
    }
  },

  // Get a specific booking (integrated into ReviewController)
  getBooking: async (req, res) => {
    try {
      const { bookingId } = req.params

      if (!req.session.user || !req.session.user.user_id) {
        return res.status(401).json({ error: "Please log in to view booking details" })
      }

      const userId = req.session.user.user_id
      console.log("🔹 Getting booking:", bookingId, "for user:", userId)

      const [bookings] = await db.query(
        `
              SELECT 
                  b.*,
                  p.name as package_name,
                  p.activity_type,
                  p.price as package_price,
                  p.duration,
                  p.max_participants,
                  p.description
              FROM bookings b
              JOIN packages p ON b.package_id = p.id
              WHERE b.id = ? AND b.user_id = ?
          `,
        [bookingId, userId],
      )

      if (bookings.length === 0) {
        return res.status(404).json({ error: "Booking not found" })
      }

      console.log("✅ Retrieved booking:", bookingId)
      res.json(bookings[0])
    } catch (error) {
      console.error("❌ Error fetching booking:", error)
      res.status(500).json({ error: "Failed to fetch booking details" })
    }
  },

  // Get completed bookings that can be reviewed
  getCompletedBookingsForReview: async (req, res) => {
    try {
      if (!req.session.user || !req.session.user.user_id) {
        return res.status(401).json({ error: "Please log in to view your bookings" })
      }

      const userId = req.session.user.user_id
      console.log("🔹 Getting completed bookings for review for user:", userId)

      const [bookings] = await db.query(
        `
              SELECT 
                  b.*,
                  p.name as package_name,
                  p.activity_type,
                  p.price as package_price,
                  r.id as review_id
              FROM bookings b
              JOIN packages p ON b.package_id = p.id
              LEFT JOIN reviews r ON b.id = r.booking_id
              WHERE b.user_id = ? AND b.status = 'completed'
              ORDER BY b.created_at DESC
          `,
        [userId],
      )

      console.log("✅ Found", bookings.length, "completed bookings for user:", userId)
      res.json(bookings)
    } catch (error) {
      console.error("❌ Error fetching completed bookings:", error)
      res.status(500).json({ error: "Failed to fetch completed bookings" })
    }
  },

  // Get booking statistics (for admin dashboard)
  getBookingStats: async (req, res) => {
    try {
      if (!req.session.user || req.session.user.user_type !== "admin") {
        return res.status(403).json({ error: "Unauthorized: Admin access required" })
      }

      console.log("🔹 Getting booking statistics for admin")

      // Get overall booking statistics
      const [overallStats] = await db.query(`
        SELECT 
          COUNT(*) as total_bookings,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_bookings,
          COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed_bookings,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_bookings,
          COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_bookings,
          SUM(total_amount) as total_revenue,
          AVG(total_amount) as average_booking_value
        FROM bookings
      `)

      // Get bookings by month
      const [monthlyStats] = await db.query(`
        SELECT 
          DATE_FORMAT(created_at, '%Y-%m') as month_year,
          DATE_FORMAT(created_at, '%b %Y') as month,
          COUNT(*) as booking_count,
          SUM(total_amount) as monthly_revenue
        FROM bookings
        GROUP BY month_year
        ORDER BY month_year DESC
        LIMIT 12
      `)

      // Get popular packages
      const [popularPackages] = await db.query(`
        SELECT 
          p.name,
          p.activity_type,
          COUNT(b.id) as booking_count,
          SUM(b.total_amount) as total_revenue
        FROM packages p
        LEFT JOIN bookings b ON p.id = b.package_id
        GROUP BY p.id, p.name, p.activity_type
        HAVING booking_count > 0
        ORDER BY booking_count DESC, total_revenue DESC
        LIMIT 10
      `)

      res.json({
        success: true,
        overall: overallStats[0],
        monthly: monthlyStats,
        popularPackages: popularPackages,
      })
    } catch (error) {
      console.error("❌ Error fetching booking stats:", error)
      res.status(500).json({ error: "Failed to fetch booking statistics" })
    }
  },

  // Get bookings by status (for admin/provider)
  getBookingsByStatus: async (req, res) => {
    try {
      if (!req.session.user || req.session.user.user_type !== "admin") {
        return res.status(403).json({ error: "Unauthorized: Admin access required" })
      }

      const { status } = req.params
      console.log("🔹 Getting bookings with status:", status)

      const [bookings] = await db.query(
        `
              SELECT 
                  b.*,
                  p.name as package_name,
                  p.activity_type,
                  u.first_name,
                  u.last_name,
                  u.email
              FROM bookings b
              JOIN packages p ON b.package_id = p.id
              JOIN users u ON b.user_id = u.user_id
              WHERE b.status = ?
              ORDER BY b.created_at DESC
          `,
        [status],
      )

      console.log("✅ Found", bookings.length, "bookings with status:", status)
      res.json(bookings)
    } catch (error) {
      console.error("❌ Error fetching bookings by status:", error)
      res.status(500).json({ error: "Failed to fetch bookings" })
    }
  },

  // Update booking status (for admin/provider)
  updateBookingStatus: async (req, res) => {
    try {
      if (!req.session.user || req.session.user.user_type !== "admin") {
        return res.status(403).json({ error: "Unauthorized: Admin access required" })
      }

      const { bookingId } = req.params
      const { status, notes } = req.body

      console.log("🔹 Updating booking status:", bookingId, "to:", status)

      // Validate status
      const validStatuses = ["pending", "confirmed", "completed", "cancelled"]
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: "Invalid status" })
      }

      const [result] = await db.query(
        `UPDATE bookings 
               SET status = ?, 
                   admin_notes = ?, 
                   updated_at = NOW()
               WHERE id = ?`,
        [status, notes || null, bookingId],
      )

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Booking not found" })
      }

      console.log("✅ Booking status updated successfully:", bookingId)
      res.json({
        success: true,
        message: "Booking status updated successfully",
      })
    } catch (error) {
      console.error("❌ Error updating booking status:", error)
      res.status(500).json({ error: "Failed to update booking status" })
    }
  },// Get review statistics for all packages (to display with package listings)
getPackageReviewStats: async (req, res) => {
  try {
    console.log("🔹 Fetching review stats for all packages...");

    const [packageStats] = await db.query(`
      SELECT 
        p.id as package_id,
        p.name as package_name,
        p.activity_type,
        COALESCE(COUNT(r.id), 0) as total_reviews,
        COALESCE(ROUND(AVG(r.rating), 1), 0) as average_rating
      FROM packages p
      LEFT JOIN reviews r ON p.id = r.package_id
      GROUP BY p.id, p.name, p.activity_type
      ORDER BY p.id
    `);

    console.log(`✅ Found review stats for ${packageStats.length} packages`);
    res.json(packageStats);
  } catch (error) {
    console.error("❌ Error fetching package review stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch package review statistics"
    });
  }
},

// Get review stats for a single package (if you need individual package stats)
getSinglePackageStats: async (req, res) => {
  try {
    const { packageId } = req.params;
    console.log(`🔹 Fetching review stats for package ${packageId}...`);

    const [stats] = await db.query(`
      SELECT 
        p.id as package_id,
        p.name as package_name,
        p.activity_type,
        COALESCE(COUNT(r.id), 0) as total_reviews,
        COALESCE(ROUND(AVG(r.rating), 1), 0) as average_rating
      FROM packages p
      LEFT JOIN reviews r ON p.id = r.package_id
      WHERE p.id = ?
      GROUP BY p.id, p.name, p.activity_type
    `, [packageId]);

    if (stats.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Package not found"
      });
    }

    console.log(`✅ Found review stats for package ${packageId}`);
    res.json(stats[0]);
  } catch (error) {
    console.error("❌ Error fetching single package review stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch package review statistics"
    });
  }
},
}

module.exports = ReviewController
