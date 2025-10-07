const db = require("../config/db")

class Review {
  // Create a new review
  static async create(reviewData) {
    const { booking_id, user_id, package_id, rating, comment } = reviewData
    const [result] = await db.query(
      `INSERT INTO reviews (booking_id, user_id, package_id, rating, comment, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [booking_id, user_id, package_id, rating, comment],
    )
    return result.insertId
  }

  // Check if review already exists for a booking
  static async findByBookingId(bookingId) {
    const [rows] = await db.query("SELECT * FROM reviews WHERE booking_id = ?", [bookingId])
    return rows[0] || null
  }

  // Get all reviews for a specific package
  static async findByPackageId(packageId) {
    const [rows] = await db.query(
      `SELECT r.*, u.first_name, u.last_name, r.created_at as review_date
       FROM reviews r
       JOIN users u ON r.user_id = u.user_id
       WHERE r.package_id = ?
       ORDER BY r.created_at DESC`,
      [packageId],
    )
    return rows
  }

  // Get review statistics for a package
  static async getPackageStats(packageId) {
    const [rows] = await db.query(
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
    return rows[0]
  }

  // Verify if user can review this booking
  static async canUserReview(bookingId, userId) {
    const [rows] = await db.query(
      `SELECT b.*, p.id as package_id 
       FROM bookings b 
       JOIN packages p ON b.package_id = p.id 
       WHERE b.id = ? AND b.user_id = ? AND b.status = "completed"`,
      [bookingId, userId],
    )
    return rows[0] || null
  }

  // Get user's reviews
  static async findByUserId(userId) {
    const [rows] = await db.query(
      `SELECT r.*, p.name as package_name, p.activity_type
       FROM reviews r
       JOIN packages p ON r.package_id = p.id
       WHERE r.user_id = ?
       ORDER BY r.created_at DESC`,
      [userId],
    )
    return rows
  }

  // Update a review
  static async update(reviewId, userId, updateData) {
    const { rating, comment } = updateData
    const [result] = await db.query(
      `UPDATE reviews 
       SET rating = ?, comment = ?, updated_at = NOW()
       WHERE id = ? AND user_id = ?`,
      [rating, comment, reviewId, userId],
    )
    return result.affectedRows > 0
  }

  // Delete a review
  static async delete(reviewId, userId) {
    const [result] = await db.query("DELETE FROM reviews WHERE id = ? AND user_id = ?", [reviewId, userId])
    return result.affectedRows > 0
  }

  // Get packages with their review statistics
  static async getPackagesWithStats() {
    const [rows] = await db.query(`
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
    return rows
  }

  // Get all reviews with package and user information (for admin)
  static async getAllWithDetails() {
    const [rows] = await db.query(`
      SELECT 
        r.*,
        u.first_name,
        u.last_name,
        u.email,
        p.name as package_name,
        p.activity_type
      FROM reviews r
      JOIN users u ON r.user_id = u.user_id
      JOIN packages p ON r.package_id = p.id
      ORDER BY r.created_at DESC
    `)
    return rows
  }

  // Get review statistics by activity type
  static async getStatsByActivityType() {
    const [rows] = await db.query(`
      SELECT 
        p.activity_type,
        COUNT(r.id) as review_count,
        AVG(r.rating) as average_rating,
        COUNT(CASE WHEN r.rating = 5 THEN 1 END) as five_star_count,
        COUNT(CASE WHEN r.rating = 4 THEN 1 END) as four_star_count,
        COUNT(CASE WHEN r.rating = 3 THEN 1 END) as three_star_count,
        COUNT(CASE WHEN r.rating = 2 THEN 1 END) as two_star_count,
        COUNT(CASE WHEN r.rating = 1 THEN 1 END) as one_star_count
      FROM reviews r
      JOIN packages p ON r.package_id = p.id
      GROUP BY p.activity_type
    `)
    return rows
  }

  // Get recent reviews (for dashboard)
  static async getRecent(limit = 10) {
    const [rows] = await db.query(
      `
      SELECT 
        r.*,
        u.first_name,
        u.last_name,
        p.name as package_name,
        p.activity_type
      FROM reviews r
      JOIN users u ON r.user_id = u.user_id
      JOIN packages p ON r.package_id = p.id
      ORDER BY r.created_at DESC
      LIMIT ?
    `,
      [limit],
    )
    return rows
  }

  // Check if user has reviewed a specific package
  static async hasUserReviewedPackage(userId, packageId) {
    const [rows] = await db.query(
      `SELECT r.id 
       FROM reviews r
       JOIN bookings b ON r.booking_id = b.id
       WHERE r.user_id = ? AND r.package_id = ?`,
      [userId, packageId],
    )
    return rows.length > 0
  }

  // Get average rating for all packages (for public display)
  static async getPackageRatings() {
    const [rows] = await db.query(`
      SELECT 
        package_id,
        COUNT(*) as review_count,
        AVG(rating) as average_rating
      FROM reviews
      GROUP BY package_id
    `)
    return rows
  }

  // ========== NEW METHODS FOR REVIEW STATISTICS ==========

  // Get comprehensive review statistics (for the new dashboard)
  static async getReviewStatistics() {
    try {
      console.log("🔹 Fetching comprehensive review statistics from model...");

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

      return {
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
    } catch (error) {
      console.error("❌ Error in Review.getReviewStatistics:", error);
      throw error;
    }
  }

  // Get recent reviews with limit (enhanced version for the new dashboard)
  static async getRecentReviews(limit = 6) {
    try {
      console.log(`🔹 Fetching ${limit} recent reviews from model...`);

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

      console.log(`✅ Found ${reviews.length} recent reviews in model`);
      return reviews;
    } catch (error) {
      console.error("❌ Error in Review.getRecentReviews:", error);
      throw error;
    }
  }

  // Get reviews for a specific package (enhanced for the new dashboard)
  static async getPackageReviews(packageId) {
    try {
      console.log(`🔹 Fetching reviews for package ${packageId} from model...`);

      // Get package reviews
      const [reviews] = await db.query(
        `
        SELECT 
          r.*,
          u.first_name,
          u.last_name,
          r.created_at as review_date
        FROM reviews r
        JOIN users u ON r.user_id = u.user_id
        WHERE r.package_id = ?
        ORDER BY r.created_at DESC
      `,
        [packageId]
      );

      // Get package review statistics
      const [statsResult] = await db.query(
        `
        SELECT 
          COUNT(*) as total_reviews,
          AVG(rating) as average_rating
        FROM reviews
        WHERE package_id = ?
      `,
        [packageId]
      );

      const stats = statsResult[0];

      return {
        reviews,
        stats: {
          total_reviews: parseInt(stats.total_reviews) || 0,
          average_rating: parseFloat(stats.average_rating) || 0,
        }
      };
    } catch (error) {
      console.error("❌ Error in Review.getPackageReviews:", error);
      throw error;
    }
  }

  // Create a new review (enhanced version that works with the new system)
  static async createReview(reviewData) {
    try {
      console.log("🔹 Creating new review in model...", reviewData);

      // Check if review already exists for this booking
      const [existingReview] = await db.query(
        'SELECT id FROM reviews WHERE booking_id = ?',
        [reviewData.booking_id]
      );

      if (existingReview.length > 0) {
        throw new Error('Review already exists for this booking');
      }

      // Get user_id from booking
      const [bookingResult] = await db.query(
        'SELECT user_id FROM bookings WHERE id = ?',
        [reviewData.booking_id]
      );

      if (bookingResult.length === 0) {
        throw new Error('Booking not found');
      }

      const user_id = bookingResult[0].user_id;

      // Insert the review
      const [result] = await db.query(
        `
        INSERT INTO reviews (
          booking_id, 
          user_id, 
          package_id, 
          rating, 
          comment, 
          created_at
        ) VALUES (?, ?, ?, ?, ?, NOW())
      `,
        [
          reviewData.booking_id,
          user_id,
          reviewData.package_id,
          reviewData.rating,
          reviewData.comment || null
        ]
      );

      console.log("✅ Review created successfully with ID:", result.insertId);
      return {
        id: result.insertId,
        ...reviewData,
        user_id,
        created_at: new Date()
      };
    } catch (error) {
      console.error("❌ Error in Review.createReview:", error);
      throw error;
    }
  }

  // Get all reviews with optional filters (enhanced version)
  static async getAllReviews(filters = {}) {
    try {
      console.log("🔹 Fetching all reviews from model with filters:", filters);

      let query = `
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
      `;

      const conditions = [];
      const params = [];

      if (filters.package_id) {
        conditions.push('r.package_id = ?');
        params.push(filters.package_id);
      }

      if (filters.rating) {
        conditions.push('r.rating = ?');
        params.push(filters.rating);
      }

      if (filters.user_id) {
        conditions.push('r.user_id = ?');
        params.push(filters.user_id);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ' ORDER BY r.created_at DESC';

      if (filters.limit) {
        query += ' LIMIT ?';
        params.push(parseInt(filters.limit));
      }

      const [reviews] = await db.query(query, params);

      console.log(`✅ Found ${reviews.length} reviews in model`);
      return reviews;
    } catch (error) {
      console.error("❌ Error in Review.getAllReviews:", error);
      throw error;
    }
  }

  // Get review by ID (enhanced version)
  static async getReviewById(reviewId) {
    try {
      console.log(`🔹 Fetching review ${reviewId} from model...`);

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
        WHERE r.id = ?
      `,
        [reviewId]
      );

      if (reviews.length === 0) {
        return null;
      }

      console.log("✅ Review found in model");
      return reviews[0];
    } catch (error) {
      console.error("❌ Error in Review.getReviewById:", error);
      throw error;
    }
  }

  // Update a review (enhanced version)
  static async updateReview(reviewId, updateData) {
    try {
      console.log(`🔹 Updating review ${reviewId} in model...`, updateData);

      const [result] = await db.query(
        `
        UPDATE reviews 
        SET rating = ?, comment = ?, updated_at = NOW()
        WHERE id = ?
      `,
        [updateData.rating, updateData.comment || null, reviewId]
      );

      if (result.affectedRows === 0) {
        throw new Error('Review not found');
      }

      console.log("✅ Review updated successfully");
      return { id: reviewId, ...updateData };
    } catch (error) {
      console.error("❌ Error in Review.updateReview:", error);
      throw error;
    }
  }

  // Delete a review (enhanced version)
  static async deleteReview(reviewId) {
    try {
      console.log(`🔹 Deleting review ${reviewId} in model...`);

      const [result] = await db.query('DELETE FROM reviews WHERE id = ?', [reviewId]);

      if (result.affectedRows === 0) {
        throw new Error('Review not found');
      }

      console.log("✅ Review deleted successfully");
      return { message: 'Review deleted successfully' };
    } catch (error) {
      console.error("❌ Error in Review.deleteReview:", error);
      throw error;
    }
  }

  // ========== EXISTING BOOKING METHODS (UNCHANGED) ==========

  // Get user's bookings
  static async getUserBookings(userId) {
    const [rows] = await db.query(
      `
      SELECT 
          b.*,
          p.name as package_name,
          p.activity_type,
          p.price as package_price
      FROM bookings b
      JOIN packages p ON b.package_id = p.id
      WHERE b.user_id = ?
      ORDER BY b.created_at DESC
    `,
      [userId],
    )
    return rows
  }

  // Get user's bookings with ratings
  static async getUserBookingsWithRatings(userId) {
    const [rows] = await db.query(
      `
    SELECT 
        b.*,
        p.name as package_name,
        p.activity_type,
        p.price as package_price,
        p.duration,
        p.max_participants,
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
    return rows
  }

  // Create a new booking
  static async createBooking(bookingData) {
    const {
      user_id,
      package_id,
      booking_date,
      number_of_participants,
      total_amount,
      contact_number,
      emergency_contact,
      emergency_phone,
      special_requests,
      booking_reference,
    } = bookingData

    const [result] = await db.query(
      `INSERT INTO bookings 
       (user_id, package_id, booking_date, number_of_participants, total_amount, 
        contact_number, emergency_contact, emergency_phone, special_requests, 
        booking_reference, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
      [
        user_id,
        package_id,
        booking_date,
        number_of_participants,
        total_amount,
        contact_number,
        emergency_contact,
        emergency_phone,
        special_requests,
        booking_reference,
      ],
    )
    return result.insertId
  }

  // Cancel a booking
  static async cancelBooking(bookingId, userId, cancellationReason) {
    const [result] = await db.query(
      `UPDATE bookings 
       SET status = 'cancelled', 
           cancellation_reason = ?, 
           cancelled_at = NOW(),
           updated_at = NOW()
       WHERE id = ? AND user_id = ? AND status = 'pending'`,
      [cancellationReason, bookingId, userId],
    )
    return result.affectedRows > 0
  }

  // Get a specific booking
  static async getBookingById(bookingId, userId) {
    const [rows] = await db.query(
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
    return rows[0] || null
  }

  // Get completed bookings that can be reviewed
  static async getCompletedBookingsForReview(userId) {
    const [rows] = await db.query(
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
    return rows
  }

  // Get booking statistics (for admin)
  static async getBookingStats() {
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

    return {
      overall: overallStats[0],
      monthly: monthlyStats,
      popularPackages: popularPackages,
    }
  }

  // Get bookings by status (for admin)
  static async getBookingsByStatus(status) {
    const [rows] = await db.query(
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
    return rows
  }

  // Update booking status (for admin)
  static async updateBookingStatus(bookingId, status, notes) {
    const [result] = await db.query(
      `UPDATE bookings 
       SET status = ?, 
           admin_notes = ?, 
           updated_at = NOW()
       WHERE id = ?`,
      [status, notes, bookingId],
    )
    return result.affectedRows > 0
  }

  // Generate booking reference
  static generateBookingReference() {
    const prefix = "GG" // GaleraGo prefix
    const timestamp = Date.now().toString().slice(-6) // Last 6 digits of timestamp
    const random = Math.random().toString(36).substr(2, 4).toUpperCase() // 4 random chars
    return `${prefix}${timestamp}${random}`
  }
}

module.exports = Review