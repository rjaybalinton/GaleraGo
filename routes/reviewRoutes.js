const express = require("express")
const router = express.Router()
const ReviewController = require("../controller/ReviewController")
const sessionAuth = require("../middleware/sessionAuth")

// API Routes for Reviews

// Create a new review (requires authentication)
router.post("/api/reviews", sessionAuth, ReviewController.createReview)

// Get reviews for a specific package (public - no auth required)
router.get("/api/packages/:packageId/reviews", ReviewController.getPackageReviews)

// Removed duplicate routes to avoid conflicts with main router

// Get current user's reviews (requires authentication)
router.get("/api/my-reviews", sessionAuth, ReviewController.getUserReviews)

// Update a review (requires authentication)
router.put("/api/reviews/:reviewId", sessionAuth, ReviewController.updateReview)

// Delete a review (requires authentication)
router.delete("/api/reviews/:reviewId", sessionAuth, ReviewController.deleteReview)

// Get packages with review statistics (for admin/provider)
router.get("/api/packages-with-stats", sessionAuth, ReviewController.getPackagesWithStats)

// Get review statistics for admin dashboard (existing - requires auth)
router.get("/api/review-stats", sessionAuth, ReviewController.getReviewStats)

// NEW ROUTES - Public routes for the review statistics dashboard
router.get("/api/public/review-stats", ReviewController.getReviewStatistics)
router.get("/api/reviews/recent", ReviewController.getRecentReviews)

// API Routes for Bookings (integrated into ReviewController)

// Get user's bookings (for booking history)
router.get("/api/bookings/my", ReviewController.getUserBookings)

// Get user's bookings with ratings (enhanced version)
router.get("/api/bookings/my-with-ratings", ReviewController.getUserBookingsWithRatings)

// Create a new booking
router.post("/api/bookings", ReviewController.createBooking)

// Cancel a booking
router.delete("/api/bookings/:bookingId/cancel", ReviewController.cancelBooking)

// Get a specific booking
router.get("/api/bookings/:bookingId", ReviewController.getBooking)

// Update booking status (for admin/provider)
router.put("/api/bookings/:bookingId/status", ReviewController.updateBookingStatus)

// Get booking statistics (for admin dashboard)
router.get("/api/bookings/stats", ReviewController.getBookingStats)

// Get bookings by status (for admin/provider)
router.get("/api/bookings/status/:status", ReviewController.getBookingsByStatus)

// Get completed bookings that can be reviewed
router.get("/api/bookings/completed-for-review", ReviewController.getCompletedBookingsForReview)

// Page Routes (if you want to render review pages)

// Review form page (requires authentication)
router.get("/review/:bookingId", sessionAuth, (req, res) => {
  try {
    const { bookingId } = req.params
    if (!req.session.user) {
      req.session.error = "Please log in to leave a review."
      return res.redirect("/userlogin")
    }
    res.render("reviewForm", {
      title: "Leave a Review",
      user: req.session.user,
      bookingId: bookingId,
      error: req.session.error,
      success: req.session.success,
    })
    // Clear session messages
    delete req.session.error
    delete req.session.success
  } catch (error) {
    console.error("Error rendering review form:", error)
    req.session.error = "Failed to load review form."
    res.redirect("/user/home")
  }
})
// review and rate dispalying:
router.get("/packages/review-stats", ReviewController.getPackageReviewStats)
router.get("/packages/:packageId/review-stats", ReviewController.getSinglePackageStats)
module.exports = router