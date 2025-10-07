const express = require('express');
const router = express.Router();
const db = require('../config/db'); // Use your existing database connection
const sessionAuth = require('../middleware/sessionAuth');  // Correct the path if needed
const roleAuth = require('../middleware/roleAuth');
const { PDFDocument, rgb } = require('pdf-lib'); // PDF generation

// Get all tourist locations for the dropdown
router.get('/api/tourist-locations', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT id, name, latitude, longitude, category, description, 
                   address, opening_hours, contact_info, website, 
                   entrance_fee, rating, image
            FROM tourist_locations
            ORDER BY name
        `);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching tourist locations:', error);
        res.status(500).json({ error: 'Failed to fetch tourist locations' });
    }
});

// Get nearby locations based on user's position
router.get('/api/nearby-locations', async (req, res) => {
    try {
        const { lat, lng, radius = 5 } = req.query; // radius in kilometers
        
        if (!lat || !lng) {
            return res.status(400).json({ error: 'Latitude and longitude are required' });
        }

        // Calculate nearby locations using Haversine formula in MySQL
        const [rows] = await db.query(`
            SELECT id, name, latitude, longitude, category, description, 
                   address, opening_hours, contact_info, website, 
                   entrance_fee, rating, image,
                   (6371 * acos(cos(radians(?)) * cos(radians(latitude)) * cos(radians(longitude) - radians(?)) + sin(radians(?)) * sin(radians(latitude)))) AS distance
            FROM tourist_locations
            HAVING distance < ?
            ORDER BY distance
        `, [lat, lng, lat, radius]);
        
        res.json(rows);
    } catch (error) {
        console.error('Error fetching nearby locations:', error);
        res.status(500).json({ error: 'Failed to fetch nearby locations' });
    }
});

// Get details for a specific location
router.get('/api/tourist-locations/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query('SELECT * FROM tourist_locations WHERE id = ?', [id]);
        
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Tourist location not found' });
        }
        
        res.json(rows[0]);
    } catch (error) {
        console.error('Error fetching tourist location details:', error);
        res.status(500).json({ error: 'Failed to fetch tourist location details' });
    }
});

// Render the navigation page
router.get('/navigation', (req, res) => {
    // Always provide a default user object if not in session
    const user = req.session && req.session.user ? req.session.user : { username: 'Guest' };
    
    res.render('navigation', { 
        user: user
    });
});


// Public packages route (for tourists to view) - MOVED TO REVIEW ROUTES
// This route was moved to reviewRoutes.js to avoid conflicts with route registration order

// Island page route
router.get('/tourist/islands', (req, res) => {
  console.log('Session user:', req.session.user); // Debug line
  
  if (!req.session.user || req.session.user.user_type !== 'tourist') {
    return res.redirect('/login');
  }
  
  res.render('IslandPage', { 
    user: req.session.user,
    title: 'Island Adventures'
  });
});

// Create booking
router.post('/api/bookings', async (req, res) => {
  try {
    if (!req.session.user || req.session.user.user_type !== 'tourist') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const {
      package_id,
      booking_date,
      number_of_participants,
      contact_number,
      emergency_contact,
      emergency_phone,
      special_requests
    } = req.body;

    // Get package details
    const [packageResult] = await db.query('SELECT * FROM packages WHERE id = ?', [package_id]);
    if (packageResult.length === 0) {
      return res.status(404).json({ error: 'Package not found' });
    }

    const package = packageResult[0];
    
    // Check if participants exceed max
    if (number_of_participants > package.max_participants) {
      return res.status(400).json({ error: `Maximum ${package.max_participants} participants allowed` });
    }

    // Get tourist info
    const [touristResult] = await db.query('SELECT tourist_id FROM tourists WHERE user_id = ?', [req.session.user.user_id]);
    if (touristResult.length === 0) {
      return res.status(400).json({ error: 'Tourist profile not found. Please complete your profile first.' });
    }

    const tourist_id = touristResult[0].tourist_id;
    const total_amount = parseFloat(package.price) * parseInt(number_of_participants);
    
    // Generate booking reference
    const booking_reference = 'PG' + Date.now().toString().slice(-8);

    // Create booking (default to pending status)
    const [result] = await db.query(`
      INSERT INTO bookings (
        package_id, tourist_id, user_id, booking_date, number_of_participants,
        total_amount, contact_number, emergency_contact, emergency_phone,
        special_requests, booking_reference, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())
    `, [
      package_id, tourist_id, req.session.user.user_id, booking_date,
      number_of_participants, total_amount, contact_number,
      emergency_contact, emergency_phone, special_requests, booking_reference
    ]);

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      booking_id: result.insertId,
      booking_reference: booking_reference,
      total_amount: total_amount
    });

  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// Get user bookings
router.get('/api/bookings/my', async (req, res) => {
  try {
    console.log('🔍 TOURIST ROUTES - /api/bookings/my called');
    console.log('Session user:', req.session.user);
    if (!req.session.user) {
      return res.status(403).json({ error: 'Unauthorized - No session' });
    }
    
    // Remove user_type restriction temporarily to debug
    // if (req.session.user.user_type !== 'tourist') {
    //   return res.status(403).json({ error: 'Unauthorized - Not a tourist' });
    // }

    const [bookings] = await db.query(`
      SELECT 
        b.*, 
        p.name as package_name, 
        p.activity_type, 
        p.image as package_image,
        p.gcash_number as provider_gcash_number,
        p.gcash_name as provider_gcash_name,
        COALESCE(NULLIF(CONCAT(TRIM(pu.first_name), ' ', TRIM(pu.last_name)), ' '), pu.username, 'Unknown') AS provider_name,
        pu.contact_number AS provider_contact,
        pu.contact_number AS provider_phone
      FROM bookings b
      JOIN packages p ON b.package_id = p.id
      LEFT JOIN users pu ON p.created_by = pu.user_id
      WHERE b.user_id = ?
      ORDER BY b.created_at DESC
    `, [req.session.user.user_id]);

    // Debug: Log provider contact information
    console.log('Bookings with provider info:', bookings.map(booking => ({
      id: booking.id,
      package_name: booking.package_name,
      status: booking.status,
      payment_method: booking.payment_method,
      provider_name: booking.provider_name,
      provider_contact: booking.provider_contact,
      provider_phone: booking.provider_phone,
      provider_gcash_number: booking.provider_gcash_number,
      provider_gcash_name: booking.provider_gcash_name,
      contact_number_raw: booking.provider_contact,
      phone_raw: booking.provider_phone
    })));
    
    // Debug: Check specific packages and their creators
    try {
      const [packageCreators] = await db.execute(`
          SELECT p.id, p.name, p.created_by, u.user_id, u.username, u.contact_number, u.user_type
          FROM packages p
          LEFT JOIN users u ON p.created_by = u.user_id
          WHERE p.id IN (8, 19, 14, 15, 13)
      `);
      console.log('Package creators in touristRoutes:', packageCreators);
    } catch (err) {
      console.log('Error checking package creators:', err.message);
    }
    
    // Debug: Check for cancelled GCash bookings
    const cancelledGCashBookings = bookings.filter(booking => 
      booking.status === 'cancelled' && booking.payment_method === 'gcash'
    );
    console.log('Cancelled GCash bookings found:', cancelledGCashBookings.length);
    cancelledGCashBookings.forEach((booking, index) => {
      console.log(`🚨 CANCELLED GCASH BOOKING ${index + 1}:`, {
        booking_id: booking.id,
        package: booking.package_name,
        contact_number: booking.provider_contact,
        phone: booking.provider_phone,
        has_contact: !!(booking.provider_contact || booking.provider_phone)
      });
    });

    console.log('🔍 TOURIST ROUTES - Returning bookings:', bookings.length);
    console.log('🔍 Sample booking data:', bookings[0]);
    
    res.json(bookings);
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});
// Delete or cancel booking
router.delete('/api/bookings/:bookingId/cancel', sessionAuth, roleAuth(['tourist']), async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { cancellation_reason } = req.body;  // Get the cancellation reason from the request body

        // Ensure the user is a tourist
        if (req.session.user.user_type !== 'tourist') {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Find the booking in the database
        const [booking] = await db.query('SELECT * FROM bookings WHERE id = ? AND user_id = ?', [bookingId, req.session.user.user_id]);

        if (booking.length === 0) {
            return res.status(404).json({ error: 'Booking not found or does not belong to this user' });
        }

        // Check if the booking is already completed or canceled
        if (booking[0].status === 'completed' || booking[0].status === 'cancelled') {
            return res.status(400).json({ error: 'Booking cannot be canceled' });
        }

        // Update booking status to 'cancelled' and add cancellation reason
       await db.query(`
  UPDATE bookings
  SET status = 'cancelled',
      cancellation_reason = ?, 
      updated_at = NOW()  // No cancelled_at here anymore
  WHERE id = ? AND user_id = ? AND status = 'pending'
`, [cancellation_reason, bookingId, userId]);

        res.json({ success: true, message: 'Booking has been canceled successfully.' });
    } catch (error) {
        console.error('Error canceling booking:', error);
        res.status(500).json({ error: 'Failed to cancel booking' });
    }
});



module.exports = router;