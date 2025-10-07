const express = require('express');
const router = express.Router();
const db = require('../config/db'); // Adjust path to your database config

// Booking history route
router.get('/api/bookings/history', async (req, res) => {
    console.log('=== Booking History Route Accessed ===');
    console.log('Session user:', req.session?.user);
    console.log('Full session:', req.session);
    
    try {
        // Get user ID from session
        const userId = req.session?.user?.user_id || req.session?.user?.id;
        
        console.log('Extracted user ID:', userId);
        
        if (!userId) {
            console.log('No user ID found in session');
            return res.status(401).json({
                success: false,
                error: 'User not authenticated',
                debug: {
                    session: req.session,
                    user: req.session?.user
                }
            });
        }
        
        console.log('Fetching bookings for user ID:', userId);
        
        // Debug: Test database connection
        try {
            const [dbTest] = await db.execute('SELECT 1 as test');
            console.log('Database connection test:', dbTest);
            
            // Test database name
            const [dbNameTest] = await db.execute('SELECT DATABASE() as db_name');
            console.log('Current database:', dbNameTest);
        } catch (err) {
            console.log('Database connection error:', err.message);
        }
        
        // Debug: Check what columns are available in users table
        try {
            const [userColumns] = await db.execute("DESCRIBE users");
            console.log('Users table columns:', userColumns.map(col => col.Field));
            
            // Debug: Check packages table structure
            const [packageColumns] = await db.execute("DESCRIBE packages");
            console.log('Packages table columns:', packageColumns.map(col => col.Field));
            
            // Debug: Check what's in the contact_number field for providers
            const [providerContacts] = await db.execute(`
                SELECT u.user_id, u.username, u.contact_number, u.first_name, u.last_name, u.user_type
                FROM users u 
                WHERE u.user_type IN ('provider', 'activity_provider', 'admin')
                LIMIT 10
            `);
            console.log('Provider contact information:', providerContacts);
            
            // Debug: Check all user types
            const [userTypes] = await db.execute(`
                SELECT DISTINCT user_type, COUNT(*) as count
                FROM users 
                GROUP BY user_type
            `);
            console.log('User types in database:', userTypes);
            
            // Debug: Check package-provider relationships
            const [packageProviders] = await db.execute(`
                SELECT p.id, p.name, p.created_by, u.user_id, u.username, u.contact_number
                FROM packages p
                LEFT JOIN users u ON p.created_by = u.user_id
                LIMIT 5
            `);
            console.log('Package-provider relationships:', packageProviders);
            
            // Debug: Check specific booking-package-provider relationship
            const [bookingProviderTest] = await db.execute(`
                SELECT b.id as booking_id, b.package_id, p.name as package_name, p.created_by, 
                       u.user_id, u.username, u.contact_number, u.user_type
                FROM bookings b
                JOIN packages p ON b.package_id = p.id
                LEFT JOIN users u ON p.created_by = u.user_id
                WHERE b.user_id = ?
                LIMIT 3
            `, [userId]);
            console.log('Booking-package-provider test:', bookingProviderTest);
            
            // Debug: Check if created_by values exist in users table
            const [createdByCheck] = await db.execute(`
                SELECT DISTINCT p.created_by, u.user_id, u.username, u.contact_number, u.user_type
                FROM packages p
                LEFT JOIN users u ON p.created_by = u.user_id
                WHERE p.created_by IS NOT NULL
                LIMIT 5
            `);
            console.log('Created_by values and their users:', createdByCheck);
            
            // Debug: Check specific packages and their creators
            const [packageCreators] = await db.execute(`
                SELECT p.id, p.name, p.created_by, u.user_id, u.username, u.contact_number, u.user_type
                FROM packages p
                LEFT JOIN users u ON p.created_by = u.user_id
                WHERE p.id IN (8, 19, 14, 15, 13)
            `);
            console.log('Specific package creators:', packageCreators);
        } catch (err) {
            console.log('Could not describe tables:', err.message);
        }
        
        // Updated query to match your actual database schema
        const query = `
            SELECT 
                b.id,
                b.booking_reference,
                b.booking_date,
                b.number_of_participants,
                b.total_amount,
                b.status,
                b.special_requests,
                b.created_at,
                b.payment_method,
                b.cancellation_reason,
                p.name as package_name,
                p.activity_type,
                p.price,
                p.duration,
                p.gcash_number as provider_gcash_number,
                p.gcash_name as provider_gcash_name,
                COALESCE(NULLIF(CONCAT(TRIM(pu.first_name), ' ', TRIM(pu.last_name)), ' '), pu.username, 'Unknown') AS provider_name,
                pu.contact_number AS provider_contact,
                pu.contact_number AS provider_phone
            FROM bookings b
            LEFT JOIN packages p ON b.package_id = p.id
            LEFT JOIN users pu ON p.created_by = pu.user_id
            WHERE b.user_id = ?
            ORDER BY b.created_at DESC
        `;
        
        console.log('Executing query:', query);
        console.log('With user ID parameter:', userId);
        
        // Debug: Test the exact query we're using
        const [testQuery] = await db.execute(`
            SELECT 
                b.id,
                b.package_id,
                p.name as package_name,
                p.created_by,
                pu.user_id as provider_user_id,
                pu.username as provider_username,
                pu.contact_number as provider_contact,
                pu.contact_number as provider_phone,
                pu.user_type as provider_user_type
            FROM bookings b
            LEFT JOIN packages p ON b.package_id = p.id
            LEFT JOIN users pu ON p.created_by = pu.user_id
            WHERE b.user_id = ?
            LIMIT 2
        `, [userId]);
        console.log('Test query result:', testQuery);
        
        // Debug: Check if we have any cancelled GCash bookings
        const [cancelledGCashTest] = await db.execute(`
            SELECT 
                b.id,
                b.status,
                b.payment_method,
                p.name as package_name,
                p.created_by,
                pu.contact_number as provider_contact,
                pu.username as provider_username
            FROM bookings b
            LEFT JOIN packages p ON b.package_id = p.id
            LEFT JOIN users pu ON p.created_by = pu.user_id
            WHERE b.user_id = ? AND b.status = 'cancelled' AND b.payment_method = 'gcash'
            LIMIT 5
        `, [userId]);
        console.log('Cancelled GCash bookings with contact info:', cancelledGCashTest);
        
        // Debug: Simple test to get contact info for user_id 21 (service2)
        const [user21Test] = await db.execute(`
            SELECT user_id, username, contact_number, user_type
            FROM users 
            WHERE user_id = 21
        `);
        console.log('User 21 (service2) contact info:', user21Test);
        
        // Debug: Test the exact JOIN that should work
        const [joinTest] = await db.execute(`
            SELECT 
                p.id as package_id,
                p.name as package_name,
                p.created_by,
                u.user_id,
                u.username,
                u.contact_number,
                u.user_type
            FROM packages p
            LEFT JOIN users u ON p.created_by = u.user_id
            WHERE p.id IN (8, 19, 14, 15, 13)
        `);
        console.log('Package-User JOIN test:', joinTest);
        
        // Debug: Check if we can access the specific booking data
        const [bookingTest] = await db.execute(`
            SELECT 
                b.id,
                b.package_id,
                b.status,
                b.payment_method,
                p.name as package_name,
                p.created_by,
                u.contact_number,
                u.username
            FROM bookings b
            JOIN packages p ON b.package_id = p.id
            LEFT JOIN users u ON p.created_by = u.user_id
            WHERE b.user_id = ? AND b.status = 'cancelled' AND b.payment_method = 'gcash'
            LIMIT 1
        `, [userId]);
        console.log('Specific booking test:', bookingTest);
        
        // Debug: Test the exact booking that's showing wrong info (GG067355H95N)
        const [specificBookingTest] = await db.execute(`
            SELECT 
                b.id,
                b.booking_reference,
                b.status,
                b.payment_method,
                p.name as package_name,
                p.created_by,
                u.user_id,
                u.username,
                u.contact_number,
                u.user_type
            FROM bookings b
            JOIN packages p ON b.package_id = p.id
            LEFT JOIN users u ON p.created_by = u.user_id
            WHERE b.booking_reference = 'GG067355H95N'
        `);
        console.log('Specific booking GG067355H95N test:', specificBookingTest);
        
        // Debug: Test if we can get contact info directly from users table
        const [directUserTest] = await db.execute(`
            SELECT user_id, username, contact_number, user_type
            FROM users 
            WHERE user_type = 'activity_provider'
        `);
        console.log('All activity providers:', directUserTest);
        
        // Debug: Test if we can get the specific package and its creator
        const [packageTest] = await db.execute(`
            SELECT p.id, p.name, p.created_by, u.username, u.contact_number
            FROM packages p
            LEFT JOIN users u ON p.created_by = u.user_id
            WHERE p.name = 'Balinton'
        `);
        console.log('Balinton package creator:', packageTest);
        
        // Debug: Test a simple query to verify database access
        const [simpleTest] = await db.execute(`
            SELECT COUNT(*) as total_bookings FROM bookings
        `);
        console.log('Total bookings in database:', simpleTest);
        
        // Debug: Test if we can access the users table
        const [usersTest] = await db.execute(`
            SELECT COUNT(*) as total_users FROM users
        `);
        console.log('Total users in database:', usersTest);
        
        // Execute the query
        const [rows] = await db.execute(query, [userId]);
        
        console.log('Raw database result:', rows);
        console.log('Number of bookings found:', rows.length);
        
        // Debug: Check the specific booking that's showing wrong info
        const specificBooking = rows.find(booking => booking.booking_reference === 'GG067355H95N');
        if (specificBooking) {
            console.log('🔍 Specific booking GG067355H95N details:', {
                id: specificBooking.id,
                package_name: specificBooking.package_name,
                provider_name: specificBooking.provider_name,
                provider_contact: specificBooking.provider_contact,
                provider_phone: specificBooking.provider_phone,
                provider_gcash_number: specificBooking.provider_gcash_number,
                provider_gcash_name: specificBooking.provider_gcash_name
            });
        }
        
        // Debug: Check if any bookings have provider contact info
        const bookingsWithContact = rows.filter(booking => booking.provider_contact || booking.provider_phone);
        console.log('Bookings with contact info:', bookingsWithContact.length);
        if (bookingsWithContact.length > 0) {
            console.log('Sample booking with contact:', bookingsWithContact[0]);
        }
        
        // Debug: Check all bookings and their provider info
        console.log('All bookings provider info:');
        rows.forEach((booking, index) => {
            console.log(`Booking ${index + 1}:`, {
                id: booking.id,
                package_name: booking.package_name,
                provider_name: booking.provider_name,
                provider_contact: booking.provider_contact,
                provider_phone: booking.provider_phone,
                has_contact: !!(booking.provider_contact || booking.provider_phone)
            });
        });
        
        // Debug: Log provider contact information
        rows.forEach((booking, index) => {
            console.log(`Booking ${index + 1} provider info:`, {
                booking_id: booking.id,
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
            });
            
            // Special logging for cancelled GCash bookings
            if (booking.status === 'cancelled' && booking.payment_method === 'gcash') {
                console.log(`🚨 CANCELLED GCASH BOOKING - Provider Contact:`, {
                    booking_id: booking.id,
                    package: booking.package_name,
                    contact_number: booking.provider_contact,
                    phone: booking.provider_phone,
                    has_contact: !!(booking.provider_contact || booking.provider_phone)
                });
            }
        });
        
        // Format the data for frontend
        const formattedBookings = rows.map(booking => {
            console.log('Processing booking:', booking);
            return {
                id: booking.id,
                booking_reference: booking.booking_reference,
                booking_date: booking.booking_date,
                number_of_participants: booking.number_of_participants,
                total_amount: booking.total_amount,
                status: booking.status,
                special_requests: booking.special_requests,
                created_at: booking.created_at,
                payment_method: booking.payment_method,
                refund_processed: booking.refund_processed,
                refund_processed_at: booking.refund_processed_at,
                cancellation_reason: booking.cancellation_reason,
                package_name: booking.package_name,
                activity_type: booking.activity_type,
                price: booking.price,
                duration: booking.duration,
                provider_name: booking.provider_name,
                provider_contact: booking.provider_contact,
                provider_phone: booking.provider_phone,
                provider_gcash_number: booking.provider_gcash_number,
                provider_gcash_name: booking.provider_gcash_name
            };
        });
        
        console.log('Returning formatted bookings:', formattedBookings);
        res.json(formattedBookings);
        
    } catch (error) {
        console.error('Database error in booking history route:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            success: false,
            error: 'Database error',
            details: error.message,
            stack: error.stack
        });
    }
});

// Create booking route
router.post('/api/bookings', async (req, res) => {
    console.log('=== Create Booking Route Accessed ===');
    console.log('Request body:', req.body);
    console.log('Session user:', req.session?.user);
    
    try {
        const userId = req.session?.user?.user_id || req.session?.user?.id;
        
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'User not authenticated'
            });
        }
        
        const {
            package_id,
            booking_date,
            number_of_participants,
            total_amount,
            special_requests,
            contact_number,
            emergency_contact,
            emergency_phone
        } = req.body;
        
        // Validate required fields
        if (!package_id || !booking_date || !number_of_participants || !total_amount) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }
        
        // Generate booking reference (matching your format)
        const bookingReference = 'PG' + Date.now().toString().slice(-8);
        
        // Get tourist_id for this user
        const [touristRows] = await db.execute(
            'SELECT tourist_id FROM tourists WHERE user_id = ? LIMIT 1',
            [userId]
        );
        
        if (touristRows.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Tourist profile not found. Please complete your profile first.'
            });
        }
        
        const touristId = touristRows[0].tourist_id;
        
        // Insert booking into database (matching your schema)
        const insertQuery = `
            INSERT INTO bookings (
                package_id, 
                tourist_id,
                user_id, 
                booking_reference, 
                booking_date, 
                number_of_participants, 
                total_amount, 
                special_requests,
                contact_number,
                emergency_contact,
                emergency_phone,
                status, 
                created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())
        `;
        
        const [result] = await db.execute(insertQuery, [
            package_id,
            touristId,
            userId,
            bookingReference,
            booking_date,
            number_of_participants,
            total_amount,
            special_requests || null,
            contact_number || '',
            emergency_contact || '',
            emergency_phone || ''
        ]);
        
        console.log('Booking created with ID:', result.insertId);
        
        res.json({
            success: true,
            booking_id: result.insertId,
            booking_reference: bookingReference,
            message: 'Booking created successfully'
        });
        
    } catch (error) {
        console.error('Error creating booking:', error);
        res.status(500).json({
            success: false,
            error: 'Database error',
            details: error.message
        });
    }
});

// Test route
router.get('/api/test', (req, res) => {
    console.log('Test route accessed from bookings router');
    res.json({ message: 'Bookings API is working!', timestamp: new Date() });
});

module.exports = router;